"""Dev server. `python serve.py` — http://localhost:5500

TWO REASONS THIS EXISTS RATHER THAN `python -m http.server`.

1 · CACHING. That server sends Last-Modified and no Cache-Control, so a
    browser is free to reuse a stylesheet it already has without revalidating.
    Editing css/base.css and reloading then shows the OLD palette, which reads
    as the edit having failed. This sends no-store on everything, so a reload
    is always the file on disk.

2 · CLEAN URLS. The site is deployed with `cleanUrls: true` (see vercel.json),
    so every internal link is written /download rather than /download.html.
    Under a plain static server every one of those 404s, which means the local
    site has a navigation that does not work and the deployed one does — the
    worst possible direction for that difference to run. This resolves
    /download to download.html the same way the host will, so a broken link is
    broken in both places or in neither.

It also serves 404.html with a real 404 status, which is the only way to see
that page the way a visitor would.
"""
import http.server
import os
import socketserver
import sys

PORT = 5500
ROOT = os.path.dirname(os.path.abspath(__file__))


class Server(socketserver.ThreadingTCPServer):
    """THREADED, AND IT HAS TO BE.

    socketserver.TCPServer handles one request at a time. That is fine right
    up until something holds a connection open — a browser tab keeping a
    socket warm, a fetch that never completed, a devtools panel — and from
    then on every other request queues behind it forever. The symptom is the
    whole site hanging in a second tab while the first one works perfectly,
    which reads as a bug in the site rather than in the server.

    daemon_threads so ctrl-c actually exits instead of waiting on whatever is
    still connected.
    """
    daemon_threads = True


class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def translate_path(self, path):
        """Resolve /download to download.html, the way the host does.

        Only when the extension-less path does not already exist as a
        directory: /assets must keep meaning the directory, not assets.html.
        """
        local = super().translate_path(path)
        if os.path.isdir(local) or os.path.isfile(local):
            return local
        if not os.path.splitext(local)[1]:
            candidate = local + '.html'
            if os.path.isfile(candidate):
                return candidate
        return local

    def send_error(self, code, message=None, explain=None):
        """The real 404 page, with a real 404 status."""
        if code == 404:
            page = os.path.join(ROOT, '404.html')
            if os.path.isfile(page):
                with open(page, 'rb') as f:
                    body = f.read()
                self.send_response(404)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                if self.command != 'HEAD':
                    self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, fmt, *args):
        sys.stderr.write('  %s\n' % (fmt % args))


def main():
    """NOT allow_reuse_address ON WINDOWS.

    On Unix SO_REUSEADDR only lets a socket rebind a port still in TIME_WAIT,
    which is what you want for quick restarts. On Windows it means something
    else entirely: a SECOND process is allowed to bind a port another process
    is already listening on, and connections then go to one of them
    arbitrarily. Two servers appear to start fine, both print their banner,
    and the browser reaches whichever it reaches — including a connection
    refused when the one it got has since gone. That is a miserable thing to
    debug from the symptom.

    So on Windows it stays off, and a busy port fails loudly instead.
    """
    Server.allow_reuse_address = not sys.platform.startswith('win')
    try:
        httpd = Server(('', PORT), Handler)
    except OSError as e:
        sys.exit('port %d is already in use (%s).\n'
                 'Close whatever is serving it, or change PORT at the top of '
                 'this file.' % (PORT, e.strerror or e))
    with httpd:
        print('PRAXIS CHESS  ->  http://localhost:%d   (no-store, clean URLs)'
              % PORT)
        print('ctrl-c to stop')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nstopped.')


if __name__ == '__main__':
    main()
