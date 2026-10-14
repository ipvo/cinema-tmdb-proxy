/**
 * Cloudflare Worker — TMDB Proxy for Cinema Club
 * نسخه: 1.1
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }

    if (request.method !== 'GET') {
      return jsonError('Method Not Allowed', 405);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // پروکسی عکس‌های TMDB
    if (path.startsWith('/img/')) {
      const imgPath = path.substring(4);
      const imgUrl = TMDB_IMAGE_BASE + imgPath + url.search;
      try {
        const res = await fetch(imgUrl, { headers: { 'User-Agent': 'CinemaClub/1.0' } });
        return new Response(res.body, {
          status: res.status,
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          }
        });
      } catch (err) {
        return jsonError('Image fetch error: ' + err.message, 500);
      }
    }

    const allowedPrefixes = [
      '/movie/', '/tv/', '/person/', '/search/',
      '/find/', '/genre/', '/configuration/', '/discover/',
      '/trending/', '/credit/'
    ];
    const isAllowed = allowedPrefixes.some(p => path.startsWith(p));
    if (!isAllowed) {
      return jsonError('Forbidden: path not allowed', 403);
    }

    let token = request.headers.get('X-TMDB-Token');
    if (!token) {
      token = env.TMDB_TOKEN;
    }

    if (!token) {
      return jsonError('TMDB token not provided', 401);
    }

    const tmdbUrl = new URL(TMDB_BASE + path);
    url.searchParams.forEach((v, k) => tmdbUrl.searchParams.set(k, v));

    if (!tmdbUrl.searchParams.has('language')) {
      tmdbUrl.searchParams.set('language', 'fa-IR');
    }

    try {
      const res = await fetch(tmdbUrl.toString(), {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json',
        }
      });

      const text = await res.text();

      return new Response(text, {
        status: res.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=1800',
        }
      });
    } catch (err) {
      return jsonError('TMDB fetch error: ' + err.message, 500);
    }
  }
};

function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
