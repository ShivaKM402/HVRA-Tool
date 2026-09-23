import os
import sys

def app(environ, start_response):
    status = '200 OK'
    try:
        cur = os.path.dirname(os.path.abspath(__file__))
        parent = os.path.abspath(os.path.join(cur, ".."))
        root = os.path.abspath("/")
        items_cur = os.listdir(cur) if os.path.exists(cur) else []
        items_parent = os.listdir(parent) if os.path.exists(parent) else []
        
        # Check backend location
        backend_in_parent = os.path.join(parent, "backend")
        items_backend = os.listdir(backend_in_parent) if os.path.exists(backend_in_parent) else "NOT FOUND"
        
        body = (
            f"Python: {sys.version}\n"
            f"CWD: {os.getcwd()}\n"
            f"sys.path: {sys.path}\n"
            f"Cur ({cur}): {items_cur}\n"
            f"Parent ({parent}): {items_parent}\n"
            f"Backend dir ({backend_in_parent}): {items_backend}\n"
        ).encode('utf-8')
    except Exception as e:
        import traceback
        body = f"WSGI Error:\n{traceback.format_exc()}".encode('utf-8')

    response_headers = [
        ('Content-Type', 'text/plain; charset=utf-8'),
        ('Content-Length', str(len(body)))
    ]
    start_response(status, response_headers)
    return [body]
