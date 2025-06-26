# Auto-Generating Material Platform

A comprehensive Next.js application for AI-powered material generation with internationalization support. This platform enables users to create projects, generate AI-powered prompts from reference images, and produce videos using JIMeng's Video Generation API.

## 🚀 Features

### Core Functionality
- **Project Management**: Create, organize, and manage multiple projects with sessions
- **AI Prompt Generation**: Upload images/videos and generate optimized prompts using GPT-4 Vision
- **Video Generation**: Generate videos from images using JIMeng's Video Generation API
- **Batch Processing**: Process multiple images simultaneously with queue management
- **Real-time Status Tracking**: Monitor video generation progress with live updates

### Technical Features
- **Internationalization (i18n)**: Full support for English and Chinese languages
- **Automatic Locale Detection**: Browser language detection with manual switching
- **Cloud Storage Integration**: Alibaba Cloud OSS for image/video storage
- **Redis Caching**: Session and project data persistence
- **Responsive Design**: Modern UI with Tailwind CSS
- **Type Safety**: Full TypeScript implementation

## 🏗️ Architecture

### Frontend
- **Next.js 15** with App Router
- **React 19** with hooks for state management
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **International Routing** with middleware-based locale detection

### Backend
- **Next.js API Routes** for server-side functionality
- **Redis** for session and project management
- **Multiple AI Service Integrations**:
  - OpenAI GPT-4 Vision for prompt generation
  - JIMeng API for video generation
  - Volcengine SDK for API authentication

### Cloud Services
- **Alibaba Cloud OSS** for file storage
- **Redis** for caching and session management
- **Multiple CDN Support** for global content delivery

## 📋 Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn** package manager
- **Redis** server (Docker recommended)
- **API Keys** for:
  - OpenAI API
  - JIMeng (Volcengine)
  - Alibaba Cloud OSS

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd auto-generating
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Redis Setup

#### Option A: Docker (Recommended)
```bash
# Run Redis container
docker run -d --name material-gen-redis -p 6379:6379 redis:7-alpine

# Verify Redis is running
docker exec -it material-gen-redis redis-cli ping
# Should return: PONG
```

#### Option B: WSL (Windows)
```bash
# Install WSL2 and Ubuntu
sudo apt update
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
```

#### Option C: Windows Native
1. Download Redis for Windows from: https://github.com/tporadowski/redis/releases
2. Install and run as a Windows service
3. Test connection: `redis-cli ping`

### 4. Environment Configuration

Create `.env.local` file in the root directory:

```env
# JIMeng API Credentials
JiMeng_AccessKeyId=your_jimeng_access_key
JiMeng_SecretAccessKey=your_jimeng_secret_access_key

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

# Aliyun OSS Configuration
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_oss_access_key_id
OSS_ACCESS_KEY_SECRET=your_oss_access_key_secret
OSS_BUCKET_NAME=your_oss_bucket_name

# Next.js Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Alibaba Cloud Configuration
ALIBABA_ACCESS_KEY=your_alibaba_access_key
ALIBABA_SECRET_KEY=your_alibaba_secret_key
ALIBABA_REGION=oss-us-east-1
ALIBABA_BUCKET=your_bucket_name

# Volcengine Configuration
VOLCENGINE_ACCESS_KEY_ID=your_volcengine_access_key
VOLCENGINE_SECRET_ACCESS_KEY=your_volcengine_secret_key
VOLCENGINE_REGION=us-east-1

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`

### Production Build
```bash
# Build the application
npm run build
# or
yarn build

# Start production server
npm start
# or
yarn start
```

### Additional Scripts
```bash
# Run linting
npm run lint
# or
yarn lint
```

## 📱 Usage Guide

### 1. Project Management
- **Create Project**: Click "New Project" to create a new material generation project
- **Project Organization**: Each project can contain multiple sessions
- **Session Management**: Create sessions within projects for different generation tasks

### 2. AI Prompt Generation
- **Upload Reference**: Upload images or videos as reference material
- **AI Analysis**: The system uses GPT-4 Vision to analyze your media
- **Prompt Optimization**: Generates detailed prompts optimized for Runway AI
- **Edit & Refine**: Manually edit generated prompts as needed

### 3. Video Generation
- **Batch Processing**: Select multiple images for simultaneous video generation
- **Queue Management**: Automatic queue management for API rate limiting
- **Real-time Monitoring**: Track generation progress with live status updates
- **Download Management**: Automatic downloading and organization of generated videos

### 4. Internationalization
- **Language Detection**: Automatic detection based on browser preferences
- **Manual Switching**: Use language switcher in the header
- **Supported Languages**: English (en) and Chinese (zh)
- **URL Structure**: `/en/...` or `/zh/...` for different locales

## 🌐 Internationalization Features

### Middleware-Based Routing
The application uses Next.js middleware for intelligent locale handling:

```12:26:middleware.ts
function getLocale(request: NextRequest): string {
  // Check if locale is in the pathname
  const pathname = request.nextUrl.pathname;
  const pathnameLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameLocale) return pathnameLocale;

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    // Simple language detection - check if Chinese is preferred
    if (acceptLanguage.includes('zh')) return 'zh';
    if (acceptLanguage.includes('en')) return 'en';
  }

  return defaultLocale;
}
```

### Translation Files
- `src/dictionaries/en.json` - English translations
- `src/dictionaries/zh.json` - Chinese translations

## 🔧 API Endpoints

### Project Management
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `DELETE /api/projects/[id]` - Delete project

### Session Management
- `GET /api/sessions` - List sessions for a project
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/[id]` - Update session data

### AI Generation
- `POST /api/generate-prompt` - Generate AI prompts from images
- `POST /api/jimeng-video` - Submit video generation tasks
- `GET /api/jimeng-video?taskId=...` - Check video generation status

### File Management
- `POST /api/upload-to-oss` - Upload files to cloud storage
- `POST /api/download-video` - Download generated videos

## 🚨 Troubleshooting

### Common Issues

#### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Restart Redis (Docker)
docker restart material-gen-redis

# Check logs
docker logs material-gen-redis
```

#### API Rate Limiting
- JIMeng API has rate limits - the application handles queuing automatically
- Check console logs for detailed API response information
- Reduce batch size if encountering frequent failures

#### File Upload Issues
- Ensure OSS credentials are correctly configured
- Check file size limits (varies by OSS configuration)
- Verify bucket permissions for public read access

#### Internationalization Issues
- Clear browser cache if language switching doesn't work
- Check middleware logs in console for routing issues
- Verify dictionary files are properly loaded

### Environment Issues
- **Missing Environment Variables**: Check `.env.local` file exists and contains all required variables
- **API Key Issues**: Verify all API keys are valid and have necessary permissions
- **OSS Configuration**: Ensure bucket exists and has proper access permissions

## 📄 License

This project is private and proprietary. Unauthorized copying, modification, distribution, or use is strictly prohibited.

## 🤝 Support

For technical support or questions:
1. Check the troubleshooting section above
2. Review console logs for detailed error messages
3. Verify all environment variables are properly configured
4. Ensure all required services (Redis, OSS) are running

## 🔮 Future Enhancements

- Additional AI model integrations
- Enhanced video editing capabilities
- Improved batch processing optimization
- Extended internationalization support
- Advanced project collaboration features
