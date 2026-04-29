import { logger, LogCategory } from './logger';

const originalFetch = window.fetch;

function shouldLogUrl(url: string): boolean {
    const skipPatterns = [
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
    /\/assets\//,
    /chrome-extension:/,
    /localhost:.*\/node_modules/,
  ];

  return !skipPatterns.some(pattern => pattern.test(url));
}

window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
  const [url, options] = args;
  const method = options?.method || 'GET';
  const urlString = typeof url === 'string' ? url : url.toString();

    if (!shouldLogUrl(urlString)) {
    return originalFetch(...args);
  }

  const startTime = Date.now();

  try {
    const response = await originalFetch(...args);
    const duration = Date.now() - startTime;

        if (!response.ok) {
      logger.error(
        LogCategory.API_CALL,
        `API请求失败: ${method} ${urlString} (${response.status})`,
        { method, url: urlString, status: response.status, statusText: response.statusText, duration }
      );
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

        logger.error(
      LogCategory.API_CALL,
      `API请求异常: ${method} ${urlString}`,
      {
        method,
        url: urlString,
        duration,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error.stack : undefined
    );

    throw error;
  }
};

export { originalFetch };
