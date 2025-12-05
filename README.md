# Vinyl Roulette

A fun web application that helps you decide which vinyl record to play from your Discogs collection. The app creates an interactive spinning wheel populated with albums from your collection and randomly selects one to play.

![Vinyl Roulette Demo](./demo.gif)

## Features

- 🎲 Interactive spinning wheel with your vinyl collection
- 🎵 Integration with Discogs API
- 🖼️ High-quality album artwork display
- 💫 Smooth animations and transitions
- 📱 Responsive design for all devices
- 🌈 Beautiful color scheme and modern UI

## Prerequisites

Before running the application, you'll need:

- A Discogs account and collection
- Node.js (v16 or higher)
- npm or yarn
- Docker (optional, for containerized deployment)

## Local Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd vinyl-roulette
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
VITE_DISCOGS_USERNAME=your_discogs_username
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Docker Deployment

### Building the Docker Image

1. Build the image:
```bash
docker build -t vinyl-roulette .
```

2. Run the container:
```bash
docker run -d \
  -p 80:80 \
  -e VITE_DISCOGS_USERNAME=your_discogs_username \
  --name vinyl-roulette \
  vinyl-roulette
```

The application will be available at `http://localhost:80`

### Environment Variables

- `VITE_DISCOGS_USERNAME`: Your Discogs username (required)

## Technical Details

### Tech Stack

- React with TypeScript
- Vite for build tooling
- react-custom-roulette for the wheel component
- Axios for API calls
- Docker for containerization
- Nginx for serving the production build

### Project Structure

```
vinyl-roulette/
├── src/
│   ├── components/
│   │   ├── DiscogsRoulette.tsx
│   │   └── Modal.tsx
│   ├── services/
│   │   └── discogsService.ts
│   ├── styles/
│   │   └── DiscogsRoulette.css
│   ├── App.tsx
│   └── main.tsx
├── public/
├── Dockerfile
├── nginx.conf
├── env.sh
└── package.json
```

### API Integration

The application integrates with the Discogs API to:
- Fetch your vinyl collection
- Retrieve detailed album information
- Get high-quality album artwork

### Docker Configuration

The Docker setup includes:
- Multi-stage build for optimal image size
- Nginx for serving static files
- Runtime environment variable injection
- Proper caching and compression settings

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Discogs API](https://www.discogs.com/developers) for providing access to vinyl collection data
- [react-custom-roulette](https://github.com/effectussoftware/react-custom-roulette) for the wheel component
- All contributors and maintainers

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.
