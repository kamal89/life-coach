// server.js - AI Life Coach Express Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import middleware
const { httpLogger, logger } = require('./utils/logger');
const { 
  globalErrorHandler, 
  handleNotFound, 
  logErrors,
  handleDatabaseError,
  setupProcessErrorHandlers 
} = require('./middleware/errorHandler');
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
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const goalRoutes = require('./routes/goals');
const chatRoutes = require('./routes/chat');
const analyticsRoutes = require('./routes/analytics');

// Import services
const vectorStore = require('./services/vectorStore');

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
app.use(httpLogger);
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true
}));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'frontend/build')));
}

// =============================================================================
// HEALTH CHECK ENDPOINTS
// =============================================================================

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({
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
    const dbState = mongoose.connection.readyState;
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
        status: 'configured',
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

    res.json(health);

  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(503).json({
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
  const swaggerUi = require('swagger-ui-express');
  const swaggerJsdoc = require('swagger-jsdoc');

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
    apis: ['./routes/*.js', './models/*.js']
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'AI Life Coach API Documentation'
  }));

  // Serve OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger documentation available at /api-docs');
}

// =============================================================================
// FRONTEND ROUTING (Production)
// =============================================================================

if (process.env.NODE_ENV === 'production') {
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
  });
}

// =============================================================================
// ERROR HANDLING MIDDLEWARE (Must be last)
// =============================================================================

// Log errors
app.use(logErrors);

// Handle database errors
app.use(handleDatabaseError);

// Handle 404 errors
app.all('*', handleNotFound);

// Global error handler
app.use(globalErrorHandler);

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

const connectDatabase = async () => {
  try {
    const mongoOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
    };

    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    
    logger.info('Database connected successfully', {
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState
    });

    // Database event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('Database connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Database disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Database reconnected');
    });

  } catch (error) {
    logger.error('Database connection failed', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
};

// =============================================================================
// REDIS CONNECTION (Optional)
// =============================================================================

const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    logger.info('Redis URL not provided, skipping Redis connection');
    return;
  }

  try {
    const Redis = require('ioredis');
    
    const redisOptions = {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };

    global.redisClient = new Redis(process.env.REDIS_URL, redisOptions);

    global.redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    global.redisClient.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
    });

    global.redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    await global.redisClient.connect();

  } catch (error) {
    logger.error('Redis connection failed', { 
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
      await vectorStore.initializePinecone();
      logger.info('Vector store (Pinecone) initialized');
    } else {
      await vectorStore.initializeFAISS();
      logger.info('Vector store (FAISS) initialized');
    }

  } catch (error) {
    logger.error('Service initialization failed', { 
      error: error.message 
    });
  }
};

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async (err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }

    try {
      // Close database connection
      await mongoose.connection.close();
      logger.info('Database connection closed');

      // Close Redis connection
      if (global.redisClient) {
        await global.redisClient.quit();
        logger.info('Redis connection closed');
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
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
    setupProcessErrorHandlers();

    // Connect to database
    await connectDatabase();

    // Connect to Redis (optional)
    await connectRedis();

    // Initialize services
    await initializeServices();

    // Start HTTP server
    server = app.listen(PORT, HOST, () => {
      logger.info('Server started successfully', {
        port: PORT,
        host: HOST,
        environment: process.env.NODE_ENV,
        pid: process.pid,
        nodeVersion: process.version
      });

      // Log important URLs
      logger.info('Server URLs', {
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
          logger.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`Port ${PORT} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception! Shutting down...', {
        error: err.message,
        stack: err.stack
      });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Rejection! Shutting down...', {
        error: err.message,
        stack: err.stack
      });
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start the server
startServer();

// Export app for testing
module.exports = app;