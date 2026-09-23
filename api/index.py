"""
Minimal Vercel Python function test - no Django at all.
If this returns 200, the @vercel/python runtime is working.
"""
import os
import sys


def app(environ, start_response):
    status = '200 OK'
    headers = [('Content-Type', 'text/plain; charset=utf-8'),
               ('Access-Control-Allow-Origin', '*')]
    start_response(status, headers)
    info = [
        f"Python: {sys.version}",
        f"__file__: {__file__}",
        f"cwd: {os.getcwd()}",
        f"sys.path[:4]: {sys.path[:4]}",
        f"env VERCEL: {os.environ.get('VERCEL', 'NOT SET')}",
        f"env VERCEL_ENV: {os.environ.get('VERCEL_ENV', 'NOT SET')}",
    ]
    yield ("\n".join(info) + "\n").encode('utf-8')
