# Smart City Planner Backend

A Node.js/Express backend for the Smart City Planner Flutter application.

## Features

- **Issue Reporting System**: Report city issues with photos
- **Daily Route Planning**: Plan daily commute routes
- **Multi-Destination Routing**: Optimize routes with multiple stops
- **Traffic & Weather Conditions**: Real-time city conditions
- **Image Upload**: Upload photos for issue reports
- **RESTful API**: Comprehensive API endpoints

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file based on `.env.example`:

```bash
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart-city-planner
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d
```

### 3. Install MongoDB

**Option A: Local Installation**
- Download from [mongodb.com](https://www.mongodb.com/try/download/community)
- Install and run MongoDB service

**Option B: MongoDB Atlas (Cloud)**
- Create account at [mongodb.com/cloud](https://www.mongodb.com/cloud)
- Create a cluster and get connection string
- Replace `MONGODB_URI` in `.env`

### 4. Run the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start at `http://localhost:5000`

## API Endpoints

### Issues
- `GET /api/issues` - Get all issues
- `GET /api/issues/:id` - Get single issue
- `POST /api/issues` - Create issue (supports file upload)
- `PUT /api/issues/:id` - Update issue
- `DELETE /api/issues/:id` - Delete issue

### Daily Plans
- `GET /api/daily-plans` - Get all daily plans
- `GET /api/daily-plans/:id` - Get single plan
- `POST /api/daily-plans` - Create daily plan
- `PUT /api/daily-plans/:id` - Update daily plan
- `DELETE /api/daily-plans/:id` - Delete daily plan

### Routes
- `GET /api/routes` - Get all routes
- `GET /api/routes/:id` - Get single route
- `POST /api/routes` - Create multi-destination route
- `PUT /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route

### Conditions
- `GET /api/conditions` - Get all conditions
- `GET /api/conditions/:area` - Get conditions for specific area
- `POST /api/conditions` - Create/update conditions

## Example Requests

### Create Issue with Image

```bash
curl -X POST http://localhost:5000/api/issues \
  -F "category=Pothole" \
  -F "description=Large pothole on Main St" \
  -F "location=123 Main Street" \
  -F "latitude=40.7128" \
  -F "longitude=-74.0060" \
  -F "severity=High" \
  -F "photo=@/path/to/image.jpg"
```

### Create Daily Plan

```bash
curl -X POST http://localhost:5000/api/daily-plans \
  -H "Content-Type: application/json" \
  -d '{
    "startLocation": "123 Home Street",
    "destination": "456 Work Avenue",
    "arrivalTime": "09:00",
    "distance": 15.5,
    "estimatedDuration": 45,
    "notes": "Use highway"
  }'
```

### Create Multi-Destination Route

```bash
curl -X POST http://localhost:5000/api/routes \
  -H "Content-Type: application/json" \
  -d '{
    "startLocation": "123 Home Street",
    "destinations": ["456 Work Avenue", "789 Market St", "321 Library Ln"],
    "totalDistance": 25.3,
    "totalDuration": 60,
    "optimized": true
  }'
```

### Update Traffic/Weather Conditions

```bash
curl -X POST http://localhost:5000/api/conditions \
  -H "Content-Type: application/json" \
  -d '{
    "area": "Downtown",
    "trafficStatus": "Heavy",
    "weatherStatus": "Rain",
    "temperature": 22,
    "humidity": 75,
    "visibility": 8,
    "windSpeed": 15
  }'
```

## Database Models

### Issue
- category, description, location, coordinates, photo, status, severity, timestamps

### DailyPlan
- startLocation, destination, arrivalTime, distance, estimatedDuration, route, notes, completed, timestamps

### Route
- startLocation, destinations, totalDistance, totalDuration, waypoints, optimized, notes, timestamps

### Condition
- area, trafficStatus, weatherStatus, temperature, humidity, visibility, windSpeed, lastUpdated

## Development

### Running Tests

```bash
npm test
```

### Code Style

This project follows standard Node.js conventions. Use:
- 2 space indentation
- Descriptive variable names
- Comments for complex logic

## Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Update MongoDB URI to production database
3. Use environment-specific configuration
4. Set up SSL/TLS certificates
5. Use process manager (pm2, forever, etc.)

## Troubleshooting

**MongoDB Connection Error**
- Ensure MongoDB service is running
- Check connection string in `.env`
- Verify network connectivity

**Port Already in Use**
- Change PORT in `.env`
- Or kill process: `lsof -ti:5000 | xargs kill -9`

**File Upload Issues**
- Check `uploads` directory exists
- Verify file size limit (5MB default)
- Ensure allowed MIME types

## License

ISC
