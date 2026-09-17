export async function onRequest(context) {
  const url = new URL(context.request.url);
  // 如果是 pages.dev 域名，直接 301 重定向到正式主站，保留所有路径和参数
  if (url.hostname.endsWith('.pages.dev')) {
    url.hostname = 'livephoto.skillary.ai';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
