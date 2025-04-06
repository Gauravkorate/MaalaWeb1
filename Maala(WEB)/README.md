# Maani - AI-Powered Shopping Negotiation Platform

Maani is an innovative e-commerce platform that leverages artificial intelligence to help users find and negotiate the best deals. The platform features advanced AI negotiation capabilities, multilingual support, and comprehensive price tracking.

## Features

- 🤖 AI-powered price negotiation
- 🗣️ Voice chat functionality
- 🌐 Multilingual support (English, Spanish, French, Chinese, Japanese)
- 🔍 Advanced product search system
- 📊 Price history tracking and prediction
- 🔒 Secure user authentication
- 🎨 Theme customization (light/dark mode)
- 📱 Responsive design
- 🔄 Real-time notifications
- 📍 Location-based recommendations

## Tech Stack

- Frontend: React, Material-UI, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB
- Authentication: OAuth, JWT
- Real-time Communication: Socket.io
- Internationalization: i18next
- State Management: Redux Toolkit

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Start the backend server:
   ```bash
   npm run server
   ```

## Project Structure

```
maani/
├── client/                 # Frontend React application
│   ├── public/            # Static files
│   └── src/               # Source files
│       ├── components/    # React components
│       ├── pages/         # Page components
│       ├── services/      # API services
│       ├── store/         # Redux store
│       └── utils/         # Utility functions
├── server/                # Backend Node.js application
│   ├── controllers/       # Route controllers
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   └── services/         # Business logic
└── shared/               # Shared utilities and types
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
