import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`Personal Finance API on http://localhost:${config.port} (AI: ${config.ai.enabled ? config.ai.model : 'offline mode'})`);
});
