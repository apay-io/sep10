import { Handler, Query, HTTPMethod, Route } from '../src/@types/http'
import { logger } from '../src/utils/logger';

export default function setup({
  worker,
  routes,
}: {
  worker?: string
  routes: Route[]
}) {
  if (worker && process.env.MODE === 'development') {
    // Prepend worker name to route in development to make it unique among workers.
    routes = routes.map((r) => [r[0], `/${worker}${r[1]}`, r[2]])
  }

  const findRoute = createRouter(routes)
  addEventListener('fetch', (event) => {
    logger.info(findRoute(event.request));
    event.respondWith(handleRequest(event.request, findRoute(event.request)))
  })
}

/**
 * Helper functions that when passed a request will return a
 * boolean indicating if the request uses that HTTP method,
 * header, host or referrer.
 */
const isMethod = (method: string) => (req: { method: HTTPMethod }) =>
  method === '*' || method === req.method.toUpperCase()
// const Header = (header, val) => (req) => req.headers.get(header) === val
// const Host = (host) => Header('host', host.toLowerCase())
// const Referrer = (host) => Header('referrer', host.toLowerCase())
const isPath = (regExp: string | RegExp) => (req: { url: URL }) => {
  const path = req.url.pathname
  const match = path.match(regExp) || []
  return match[0] === path
}

/**
 *
 * Create router to decide which handler should be called depending on the request path.
 */
function createRouter(routeDefinitions: Route[]) {
  const routes = routeDefinitions.map(([method, path, handler]) => ({
    conditions: [isMethod(method), isPath(path)],
    handler,
  }))

  return (request: Request) => {
    const url = new URL(request.url)
    const method = request.method as HTTPMethod
    const headers = request.headers;

    const { handler } =
      routes.find((route) =>
        route.conditions.every((condition) => condition({ url, method }))
      ) || {}

    // Parse querystring similarly to Express or Rails (there's no standard for this)
    const query: Query = new Map()
    for (const key of url.searchParams.keys()) {
      if (key.endsWith('[]')) {
        query.set(key.slice(0, -2), url.searchParams.getAll(key))
      } else {
        query.set(key, url.searchParams.get(key) || '')
      }
    }

    return { handler, headers, url, query }
  }
}

async function handleRequest(
  request: Request,
  { handler, headers, url, query }: { handler?: Handler; headers: Headers; url: URL; query: Query }
) {
  if (!handler) {
    return buildResponse({
      status: 404,
      statusText: 'Not Found',
      message: 'resource not found',
      data: null,
    })
  }

  try {
    let body = {};
    try {
      body = (await request.json()) || {}
    } catch(err) {}

    const { data = null, status = 200, statusText = 'ok', message = 'ok' } =
      (await handler({ body, headers, url, query })) || {}
    logger.info({ data, message, status, statusText });

    return buildResponse({ data, status, statusText, message })
  } catch (error) {
    logger.error(error);
    return buildResponse(error)
  }
}

/**
 *
 * Create a Response object with a consistent structure.
 */
function buildResponse({
  message = 'error',
  status = 500,
  statusText = 'Internal Server Error',
  data = null,
}: {
  message: string
  status: number
  statusText: string
  data?: object | null
}) {
  let payload

  try {
    payload = JSON.stringify(data || {})
  } catch {
    payload = `{"message":${message},"status":500}`
  }

  return new Response(payload, {
    status,
    statusText,
    headers: {
      'content-type': 'application/json',
    },
  })
}
