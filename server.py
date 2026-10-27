"""
server.py
Full-stack Python Web & API Server for VOIDRUN: Evasion Protocol.
Serves the arcade web frontend and provides REST endpoints for Python-side
simulation, neuroevolution training, and model inference.

Usage:
    python server.py [port]
    Default port: 8000
"""

import os
import sys
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Add root directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from python.genetic_algorithm import GeneticAlgorithm
from python.simulation import Simulation
from python.neural_network import NeuralNetwork

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8000))

# Global persistent GA trainer instance
ga_instance = GeneticAlgorithm(population_size=25, mutation_rate=0.08, elitism_count=3)

class VoidrunHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enforce strict anti-caching so users always receive fresh JavaScript & assets
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        url_path = self.path.split('?')[0]

        # REST API Routes
        if url_path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            payload = {
                'status': 'online',
                'project': 'Multi-Threat Evasion using Genetic Algorithms in 2D Arenas',
                'engine': 'Python-VOIDRUN-Backend',
                'generation': ga_instance.generation,
                'population_size': ga_instance.population_size,
                'mutation_rate': ga_instance.mutation_rate,
                'neural_architecture': '20 Inputs -> 16 Hidden (tanh) -> 4 Outputs (tanh)'
            }
            self.wfile.write(json.dumps(payload, indent=2).encode('utf-8'))
            return

        if url_path == '/api/checkpoints':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            # Return checkpoints metadata
            payload = {
                'gen100': {'generation': 100, 'label': 'Novice Evasion', 'survival_seconds': 47.1, 'fitness': 12265},
                'gen500': {'generation': 500, 'label': 'Advanced Pilot', 'survival_seconds': 80.6, 'fitness': 19545},
                'gen1000': {'generation': 1000, 'label': 'Apex Master', 'survival_seconds': 120.6, 'fitness': 24045}
            }
            self.wfile.write(json.dumps(payload, indent=2).encode('utf-8'))
            return

        # Default: Serve static frontend files from project root
        return super().do_GET()

    def do_POST(self):
        url_path = self.path.split('?')[0]

        if url_path == '/api/train':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len).decode('utf-8')
                data = json.loads(body) if body else {}
                generations_to_run = min(50, int(data.get('generations', 1)))

                results = []
                for _ in range(generations_to_run):
                    res = ga_instance.evolve_generation()
                    results.append(res)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'current_generation': ga_instance.generation,
                    'latest': results[-1],
                    'history': ga_instance.history[-10:]
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        if url_path == '/api/simulate':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len).decode('utf-8')
                data = json.loads(body) if body else {}

                weights = data.get('weights')
                seed = data.get('seed', 1337)
                max_ticks = min(3600, int(data.get('max_ticks', 1200)))

                net = NeuralNetwork(20, 16, 4)
                if weights and len(weights) == 404:
                    net.set_weights(weights)

                sim = Simulation(seed=seed, max_shields=3)
                for _ in range(max_ticks):
                    sim.step(net)
                    if sim.game_over:
                        break

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'ticks_survived': sim.ticks,
                    'seconds_survived': round(sim.ticks / 60.0, 2),
                    'shields_left': sim.rocket.shields,
                    'near_misses': sim.rocket.near_misses,
                    'game_over': sim.game_over
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def main():
    os.chdir(BASE_DIR)
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, VoidrunHandler)
    print("=" * 65)
    print(" VOIDRUN: Evasion Protocol — Full-Stack Python Server")
    print(f" Web & API running at: http://localhost:{PORT}")
    print(" REST API endpoints: /api/status, /api/checkpoints, /api/train")
    print(" Press Ctrl+C to terminate.")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == '__main__':
    main()
