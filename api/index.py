"""
api/index.py
Vercel Serverless Function for Python Backend.
Handles /api/* routes on Vercel deployment.
"""

from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()

        payload = {
            'status': 'online',
            'project': 'Multi-Threat Evasion using Genetic Algorithms in 2D Arenas',
            'platform': 'Vercel-Python-Runtime',
            'neural_architecture': '20 Omnidirectional Radar Inputs -> 16 Hidden Neurons -> 4 Throttle Outputs',
            'learning_method': 'Genetic Algorithms (Roulette Wheel Selection, Uniform Crossover, Gaussian Mutation)',
            'checkpoints': {
                'gen100': {'generation': 100, 'label': 'Novice Evasion', 'survival_seconds': 47.1},
                'gen500': {'generation': 500, 'label': 'Advanced Pilot', 'survival_seconds': 80.6},
                'gen1000': {'generation': 1000, 'label': 'Apex Master', 'survival_seconds': 120.6}
            }
        }
        self.wfile.write(json.dumps(payload, indent=2).encode('utf-8'))
