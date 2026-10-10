import { server }  from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Collector Server] Running on http://0.0.0.0:${PORT}`);
});