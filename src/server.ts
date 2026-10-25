import { config } from './config';
import { server } from './app';

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[Collector Server] Running on http://0.0.0.0:${config.port}`);
});
