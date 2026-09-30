import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class StartupBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="startup-panel" role="alert">
          <h1>Playlist Port</h1>
          <p>The page could not finish loading.</p>
          <p>Reload this page or open the link in your browser to try again.</p>
          <a href="/">Reload page</a>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StartupBoundary><App /></StartupBoundary>
  </React.StrictMode>
);
