import json
import urllib.request

PREVIEW_SERVICE = "http://previews.internal:8080/preview?url="


def fetch_preview(url):
    with urllib.request.urlopen(PREVIEW_SERVICE + urllib.request.quote(url, safe="")) as resp:
        return json.loads(resp.read())


def render_post(post, preview_urls):
    previews = [fetch_preview(u) for u in preview_urls]
    return {"post": post, "previews": previews}
