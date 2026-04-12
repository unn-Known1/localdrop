# Contributing to LocalDrop

Thank you for your interest in contributing to LocalDrop! This guide will help you get started with development.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/unn-Known1/localdrop.git
cd localdrop

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Project Structure

```
localdrop/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── hooks/          # Custom React hooks
│   ├── services/      # Core services (WebRTC, storage, etc.)
│   ├── workers/       # Web Workers for background tasks
│   └── lib/           # Utility functions
├── public/             # Static assets
└── docs/              # Documentation
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint issues |

## Testing

### Manual Testing

1. Start the dev server: `pnpm dev`
2. Open `http://localhost:5173` in multiple browser tabs/windows
3. Test device discovery and file transfers

### Browser Testing

Test across multiple browsers:
- Chrome (desktop)
- Firefox (desktop)
- Safari (macOS/iOS)
- Edge (Windows)

## Coding Standards

- Use TypeScript for all new code
- Follow existing component patterns
- Use meaningful variable and function names
- Add comments for complex logic

### Component Patterns

```tsx
// Functional components with hooks
const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // use hooks at top
  const [state, setState] = useState(false);

  // return JSX
  return <div>{prop1}</div>;
};
```

### Git Commits

We follow conventional commits:

```
feat: add new feature
fix: fix a bug
docs: update documentation
refactor: code refactoring
test: add tests
chore: maintenance
```

## Ways to Contribute

### 🐛 Bug Reports
- Use GitHub Issues
- Describe the bug with steps to reproduce
- Include browser/device information

### 💡 Feature Requests
- Open an issue with feature description
- Explain the use case
- Consider implementation suggestions

### 📖 Documentation
- Improve README
- Add platform-specific guides
- Fix typos and clarify content

### 🔧 Code Contributions
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Push to your fork and open a PR

## Good First Issues

 beginner-friendly tasks to start with:

- [ ] Add QR code for easy device pairing
- [ ] Document firewall configuration
- [ ] Add more platform-specific setup guides
- [ ] Improve error messages
- [ ] Add unit tests for core services

## Questions?

- Open a GitHub Discussion for questions
- Check existing issues before opening new ones