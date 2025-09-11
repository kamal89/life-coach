#!/bin/bash
# deploy.sh - Production deployment script

set -e

echo "🚀 Starting AI Life Coach deployment to AWS..."

# Configuration - Update these values
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_NAME="lifecoach"
CLUSTER_NAME="lifecoach-cluster"
SERVICE_NAME="lifecoach-service"
TASK_DEFINITION_FAMILY="lifecoach-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is required but not installed. Aborting."; exit 1; }
    command -v docker >/dev/null 2>&1 || { print_error "Docker is required but not installed. Aborting."; exit 1; }
    command -v jq >/dev/null 2>&1 || { print_error "jq is required but not installed. Aborting."; exit 1; }
    
    # Check AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || { print_error "AWS credentials not configured. Run 'aws configure' first."; exit 1; }
    
    print_status "Prerequisites check passed ✅"
}

# Create ECR repository if it doesn't exist
create_ecr_repo() {
    print_status "Checking ECR repository..."
    
    aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION >/dev/null 2>&1 || {
        print_status "Creating ECR repository: $ECR_REPO_NAME"
        aws ecr create-repository --repository-name $ECR_REPO_NAME --region $AWS_REGION
    }
}

# Build and push Docker image
build_and_push() {
    print_status "Building Docker image..."
    
    # Get AWS account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
    
    # Build image
    docker build -t $ECR_REPO_NAME:latest .
    
    # Tag for ECR
    GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    docker tag $ECR_REPO_NAME:latest $ECR_URI:latest
    docker tag $ECR_REPO_NAME:latest $ECR_URI:$GIT_COMMIT
    
    print_status "Logging in to ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    
    print_status "Pushing image to ECR..."
    docker push $ECR_URI:latest
    docker push $ECR_URI:$GIT_COMMIT
    
    echo "ECR_URI=$ECR_URI:latest" > .deploy_vars
    export ECR_URI="$ECR_URI:latest"
}

# Update ECS task definition
update_task_definition() {
    print_status "Updating ECS task definition..."
    
    # Check if task definition exists
    TASK_DEF_EXISTS=$(aws ecs describe-task-definition --task-definition $TASK_DEFINITION_FAMILY --region $AWS_REGION 2>/dev/null || echo "false")
    
    if [ "$TASK_DEF_EXISTS" = "false" ]; then
        print_status "Creating new task definition..."
        aws ecs register-task-definition \
            --cli-input-json file://aws/task-definition.json \
            --region $AWS_REGION >/dev/null
    else
        # Get current task definition
        TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_DEFINITION_FAMILY --region $AWS_REGION)
        
        # Update image URI in task definition
        NEW_TASK_DEF=$(echo $TASK_DEF | jq --arg IMAGE "$ECR_URI" '.taskDefinition | .containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.placementConstraints) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)')
        
        # Register new task definition
        aws ecs register-task-definition --region $AWS_REGION --cli-input-json "$NEW_TASK_DEF" >/dev/null
    fi
}

# Update ECS service
update_service() {
    print_status "Updating ECS service..."
    
    # Check if service exists
    SERVICE_EXISTS=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION 2>/dev/null | jq -r '.services | length')
    
    if [ "$SERVICE_EXISTS" = "0" ]; then
        print_status "Creating new ECS service..."
        aws ecs create-service \
            --cli-input-json file://aws/service-definition.json \
            --region $AWS_REGION >/dev/null
    else
        aws ecs update-service \
            --cluster $CLUSTER_NAME \
            --service $SERVICE_NAME \
            --task-definition $TASK_DEFINITION_FAMILY \
            --force-new-deployment \
            --region $AWS_REGION >/dev/null
    fi
}

# Wait for deployment to complete
wait_for_deployment() {
    print_status "Waiting for deployment to stabilize..."
    
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION
    
    if [ $? -eq 0 ]; then
        print_status "Deployment completed successfully! 🎉"
    else
        print_error "Deployment failed or timed out ❌"
        exit 1
    fi
}

# Get service status
get_service_info() {
    print_status "Getting service information..."
    
    # Get load balancer URL
    ALB_DNS=$(aws elbv2 describe-load-balancers --region $AWS_REGION --query 'LoadBalancers[?Type==`application`].DNSName' --output text | head -1 2>/dev/null || echo "Not found")
    
    if [ "$ALB_DNS" != "Not found" ] && [ "$ALB_DNS" != "" ]; then
        print_status "Application URL: http://$ALB_DNS"
    fi
    
    # Get running tasks
    TASK_COUNT=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION --query 'services[0].runningCount' --output text 2>/dev/null || echo "0")
    print_status "Running tasks: $TASK_COUNT"
    
    # Get task health
    TASK_ARNS=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --region $AWS_REGION --query 'taskArns' --output text)
    if [ "$TASK_ARNS" != "" ]; then
        print_status "Task status:"
        aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARNS --region $AWS_REGION --query 'tasks[].{TaskArn:taskArn,LastStatus:lastStatus,HealthStatus:healthStatus}' --output table
    fi
}

# Rollback function
rollback() {
    print_warning "Rolling back to previous version..."
    
    # Get previous task definition revision
    PREV_REVISION=$(aws ecs list-task-definitions --family-prefix $TASK_DEFINITION_FAMILY --sort DESC --region $AWS_REGION --query 'taskDefinitionArns[1]' --output text)
    
    if [ "$PREV_REVISION" != "None" ] && [ "$PREV_REVISION" != "" ]; then
        aws ecs update-service \
            --cluster $CLUSTER_NAME \
            --service $SERVICE_NAME \
            --task-definition $PREV_REVISION \
            --region $AWS_REGION >/dev/null
        
        print_status "Rollback initiated. Waiting for completion..."
        wait_for_deployment
    else
        print_error "No previous version found for rollback"
        exit 1
    fi
}

# Setup infrastructure
setup_infrastructure() {
    print_status "Setting up AWS infrastructure..."
    
    if [ -f "aws/cloudformation.yml" ]; then
        STACK_NAME="lifecoach-infrastructure"
        
        aws cloudformation deploy \
            --template-file aws/cloudformation.yml \
            --stack-name $STACK_NAME \
            --capabilities CAPABILITY_IAM \
            --parameter-overrides Environment=production \
            --region $AWS_REGION
        
        print_status "Infrastructure setup complete"
    else
        print_warning "CloudFormation template not found. Skipping infrastructure setup."
    fi
}

# Main deployment flow
main() {
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            create_ecr_repo
            build_and_push
            update_task_definition
            update_service
            wait_for_deployment
            get_service_info
            ;;
        "infrastructure")
            setup_infrastructure
            ;;
        "rollback")
            rollback
            ;;
        "status")
            get_service_info
            ;;
        "logs")
            print_status "Fetching recent logs..."
            aws logs tail /ecs/lifecoach-app --follow --region $AWS_REGION
            ;;
        *)
            echo "Usage: $0 {deploy|infrastructure|rollback|status|logs}"
            echo ""
            echo "Commands:"
            echo "  deploy         - Deploy application to AWS"
            echo "  infrastructure - Setup AWS infrastructure"
            echo "  rollback       - Rollback to previous version"
            echo "  status         - Show current deployment status"
            echo "  logs           - Show application logs"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main $1