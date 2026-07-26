import { createServer } from 'vite';

export async function loadSourceModule(pathname) {
  const server = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });

  try {
    return await server.ssrLoadModule(pathname);
  } finally {
    await server.close();
  }
}
