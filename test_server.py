import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class AppShellTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.FieldnoteHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def test_serves_manifest_with_installable_content_type(self):
        with urlopen(f"{self.base_url}/manifest.webmanifest") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers.get_content_type(), "application/manifest+json")
            self.assertIn('"display": "standalone"', response.read().decode("utf-8"))

    def test_serves_on_device_model_and_runtime_assets(self):
        for path, content_type, signature in [
            ("/assets/fieldnote-research-model.onnx", "application/octet-stream", None),
            ("/assets/onnxruntime-web-1.22.0.min.js", "text/javascript", None),
            ("/assets/ort-wasm-simd-threaded.mjs", "text/javascript", None),
            ("/assets/ort-wasm-simd-threaded.wasm", "application/wasm", b"\x00asm"),
        ]:
            with self.subTest(path=path), urlopen(f"{self.base_url}{path}") as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers.get_content_type(), content_type)
                body = response.read()
                if signature:
                    self.assertTrue(body.startswith(signature))

    def test_does_not_expose_a_server_side_diagnosis_api(self):
        for method, path in [
            ("GET", "/api/health"),
            ("POST", "/api/diagnose"),
        ]:
            request = Request(f"{self.base_url}{path}", data=b"" if method == "POST" else None, method=method)
            with self.subTest(method=method, path=path), self.assertRaises(HTTPError) as error:
                urlopen(request)
            self.assertEqual(error.exception.code, 404)

    def test_app_uses_local_inference_without_network_uploads(self):
        with urlopen(f"{self.base_url}/app.js") as response:
            source = response.read().decode("utf-8")
        self.assertIn("createImageBitmap(file)", source)
        self.assertIn("session.run(", source)
        self.assertNotIn("fetch(", source)
        self.assertNotIn("FormData(", source)


if __name__ == "__main__":
    unittest.main()
