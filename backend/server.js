// server.js - AI Life Coach Express Server
import express from 'express';
import Mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression';
import Path from 'path';
import Dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import Redis from 'ioredis';

// Recreate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
Dotenv.config();

// Import middleware
import Logger from '../utils/logger.js';
import ErrorHandler from '../middleware/errorHandler.js';
import securityMiddleware from '../middleware/security.js';

const {
  basicSecurity, 
  generalRateLimit, 
  authRateLimit, 
  chatRateLimit, 
  xssProtection, 
  securityHeaders, 
  corsOptions, 
  requestLogger, 
  suspiciousActivityDetector, 
  validateContentType
} = securityMiddleware;

// Import routes
import authRoutes from './services/routes/auth.js';
import userRoutes from './services/routes/users.js';
import goalRoutes from './services/routes/goals.js';
import chatRoutes from './services/routes/chat.js';
import analyticsRoutes from './services/routes/analytics.js';

// Import services
import VectorStore from './services/vectorStore.js';

// Create Express app
const app = express();

// Trust proxy for accurate IP addresses behind load balancer
app.set('trust proxy', 1);

// =============================================================================
// SECURITY MIDDLEWARE (Applied first)
// =============================================================================

// Basic security headers
app.use(basicSecurity);
app.use(securityHeaders);

// Request logging
app.use(Logger.httpLogger);
app.use(requestLogger);

// Suspicious activity detection
app.use(suspiciousActivityDetector);

// Content type validation
app.use(validateContentType(['application/json', 'multipart/form-data']));

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// =============================================================================
// BODY PARSING MIDDLEWARE
// =============================================================================

// Body parser with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// =============================================================================
// COMPRESSION AND OPTIMIZATION
// =============================================================================

// Gzip compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// =============================================================================
// XSS AND INPUT PROTECTION
// =============================================================================

app.use(...xssProtection);

// =============================================================================
// STATIC FILES
// =============================================================================

// Serve static files from uploads directory
app.use('/uploads', express.static(Path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true
}));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(Path.join(__dirname, 'frontend/build')));
}

// =============================================================================
// HEALTH CHECK ENDPOINTS
// =============================================================================

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).express.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// Detailed health check
app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0',
    services: {}
  };

  try {
    // Check database connection
    const dbState = Mongoose.connection.readyState;
    health.services.database = {
      status: dbState === 1 ? 'connected' : 'disconnected',
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState]
    };

    // Check Redis connection (if available)
    if (global.redisClient) {
      const redisStatus = global.redisClient.status;
      health.services.redis = {
        status: redisStatus === 'ready' ? 'connected' : 'disconnected',
        state: redisStatus
      };
    }

    // Check vector store
    health.services.vectorStore = {
      status: 'available',
      type: process.env.PINECONE_API_KEY ? 'pinecone' : 'faiss'
    };

    // Check AI service
    if (process.env.OPENAI_API_KEY) {
      health.services.ai = {
        status: 'Dotenv.configured',
        provider: 'openai'
      };
    }

    // Overall health based on critical services
    const criticalServices = ['database'];
    const failedServices = criticalServices.filter(
      service => health.services[service]?.status !== 'connected'
    );

    if (failedServices.length > 0) {
      health.status = 'degraded';
      res.status(503);
    }

    res.express.json(health);

  } catch (error) {
    Logger.logger.error('Health check error', { error: error.message });
    res.status(503).express.json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// API ROUTES WITH RATE LIMITING
// =============================================================================

// Apply general rate limiting to all API routes
app.use('/api', generalRateLimit);

// Authentication routes with strict rate limiting
app.use('/api/auth', authRateLimit, authRoutes);

// User routes
app.use('/api/users', userRoutes);

// Goal management routes
app.use('/api/goals', goalRoutes);

// Chat/AI routes with chat-specific rate limiting
app.use('/api/chat', chatRateLimit, chatRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// =============================================================================
// API DOCUMENTATION
// =============================================================================

if (process.env.SWAGGER_ENABLED === 'true') {
  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: process.env.API_DOCS_TITLE || 'AI Life Coach API',
        version: process.env.API_DOCS_VERSION || '1.0.0',
        description: process.env.API_DOCS_DESCRIPTION || 'REST API for AI-powered life coaching application',
      },
      servers: [
        {
          url: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
          description: process.env.NODE_ENV || 'development'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    },
    apis: ['./services/routes/*.js', './models/*.js']
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'AI Life Coach API Documentation'
  }));

  // Serve OpenAPI spec as express.json
  app.get('/api-docs.express.json', (req, res) => {
    res.setHeader('Content-Type', 'application/express.json');
    res.send(swaggerSpec);
  });

  Logger.logger.info('Swagger documentation available at /api-docs');
}

// =============================================================================
// FRONTEND ROUTING (Production)
// =============================================================================

if (process.env.NODE_ENV === 'production') {
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(Path.join(__dirname, 'frontend/build', 'index.html'));
  });
}

// =============================================================================
// ERROR HANDLING MIDDLEWARE (Must be last)
// =============================================================================

// Log errors
app.use(ErrorHandler.logErrors);

// Handle database errors
app.use(ErrorHandler.handleDatabaseError);

// Handle 404 errors
app.all('*', ErrorHandler.handleNotFound);

// Global error handler
app.use(ErrorHandler.globalErrorHandler);

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

const connectDatabase = async () => {
  try {
    await Mongoose.connect(process.env.MONGODB_URI);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// =============================================================================
// REDIS CONNECTION (Optional)
// =============================================================================

const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    Logger.logger.info('Redis URL not provided, skipping Redis connection');
    return;
  }

  try {
    const redisOptions = {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };

    global.redisClient = new Redis(process.env.REDIS_URL, redisOptions);

    global.redisClient.on('connect', () => {
      Logger.logger.info('Redis connected successfully');
    });

    global.redisClient.on('error', (err) => {
      Logger.logger.error('Redis connection error', { error: err.message });
    });

    global.redisClient.on('close', () => {
      Logger.logger.warn('Redis connection closed');
    });

    await global.redisClient.connect();

  } catch (error) {
    Logger.logger.error('Redis connection failed', { 
      error: error.message 
    });
    // Don't exit on Redis failure, it's optional
  }
};

// =============================================================================
// INITIALIZE SERVICES
// =============================================================================

const initializeServices = async () => {
  try {
    // Initialize vector store
    if (process.env.PINECONE_API_KEY) {
      await VectorStore.initializePinecone();
      Logger.logger.info('Vector store (Pinecone) initialized');
    } else {
      await VectorStore.initializeFAISS();
      Logger.logger.info('Vector store (FAISS) initialized');
    }

  } catch (error) {
    Logger.logger.error('Service initialization failed', { 
      error: error.message 
    });
  }
};

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

const gracefulShutdown = (signal) => {
  Logger.logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async (err) => {
    if (err) {
      Logger.logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }

    try {
      // Close database connection
      await Mongoose.connection.close();
      Logger.logger.info('Database connection closed');

      // Close Redis connection
      if (global.redisClient) {
        await global.redisClient.quit();
        Logger.logger.info('Redis connection closed');
      }

      Logger.logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      Logger.logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    Logger.logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

let server;

const startServer = async () => {
  try {
    // Setup process error handlers
    ErrorHandler.setupProcessErrorHandlers();

    // Connect to database
    await connectDatabase();

    // Connect to Redis (optional)
    await connectRedis();

    // Initialize services
    await initializeServices();

    // Start HTTP server
    server = app.listen(PORT, HOST, () => {
      Logger.logger.info('Server started successfully', {
        port: PORT,
        host: HOST,
        environment: process.env.NODE_ENV,
        pid: process.pid,
        nodeVersion: process.version
      });

      // Log important URLs
      Logger.logger.info('Server URLs', {
        api: `http://${HOST}:${PORT}/api`,
        health: `http://${HOST}:${PORT}/health`,
        docs: process.env.SWAGGER_ENABLED === 'true' ? `http://${HOST}:${PORT}/api-docs` : 'disabled'
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          Logger.logger.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
        case 'EADDRINUSE':
          Logger.logger.error(`Port ${PORT} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (err) => {
      Logger.logger.error('Uncaught Exception! Shutting down...', {
        error: err.message,
        stack: err.stack
      });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (err) => {
      Logger.logger.error('Unhandled Rejection! Shutting down...', {
        error: err.message,
        stack: err.stack
      });
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    Logger.logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start the server
startServer();

// Export app for testing
export default app;