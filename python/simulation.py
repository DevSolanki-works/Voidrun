"""
simulation.py
Headless 2D kinematics simulation in Python for rocket evasion.
Implements the same mechanics as GameSimulation.js:
- Bounded arena (800x600)
- Rocket with inertia, friction, and thrust physics
- Threats entering from edges
- Omnidirectional radar sensor encoding (20 inputs)
"""

import math
import random
from python.neural_network import NeuralNetwork

class Vector:
    __slots__ = ('x', 'y')
    def __init__(self, x=0.0, y=0.0):
        self.x = float(x)
        self.y = float(y)

    def set(self, x, y):
        self.x = float(x)
        self.y = float(y)

    def add(self, other):
        self.x += other.x
        self.y += other.y

    def mult(self, s):
        self.x *= s
        self.y *= s

    def mag(self):
        return math.hypot(self.x, self.y)

    def mag_sq(self):
        return self.x * self.x + self.y * self.y

    def heading(self):
        return math.atan2(self.y, self.x)

    def clamp_mag(self, max_m):
        m = self.mag()
        if m > max_m and m > 0.0001:
            self.x = (self.x / m) * max_m
            self.y = (self.y / m) * max_m

class Threat:
    def __init__(self, x, y, vx, vy, radius=18.0):
        self.pos = Vector(x, y)
        self.vel = Vector(vx, vy)
        self.radius = radius
        self.active = True

    def update(self):
        self.pos.add(self.vel)

class Rocket:
    def __init__(self, x=400.0, y=300.0, max_shields=3):
        self.pos = Vector(x, y)
        self.vel = Vector(0.0, 0.0)
        self.acc = Vector(0.0, 0.0)
        self.radius = 12.0
        self.max_speed = 5.2
        self.thrust_power = 0.42
        self.friction = 0.93
        self.shields = max_shields
        self.alive = True
        self.throttle = Vector(0.0, 0.0)
        self.ticks_alive = 0
        self.near_misses = 0

    def set_throttle(self, x, y):
        self.throttle.x = max(-1.0, min(1.0, float(x)))
        self.throttle.y = max(-1.0, min(1.0, float(y)))

    def update(self):
        if not self.alive:
            return
        self.ticks_alive += 1

        if self.throttle.mag_sq() > 0.001:
            self.acc.x = self.throttle.x * self.thrust_power
            self.acc.y = self.throttle.y * self.thrust_power
        else:
            self.acc.set(0.0, 0.0)

        self.vel.add(self.acc)
        self.vel.clamp_mag(self.max_speed)
        self.vel.mult(self.friction)
        self.pos.add(self.vel)

        # Arena bounds
        self.pos.x = max(36.0, min(764.0, self.pos.x))
        self.pos.y = max(36.0, min(564.0, self.pos.y))

class Simulation:
    def __init__(self, seed=1337, max_shields=3):
        self.width = 800
        self.height = 600
        self.max_shields = max_shields
        self.rng = random.Random(seed)
        self.rocket = Rocket(400.0, 300.0, max_shields)
        self.threats = []
        self.ticks = 0
        self.game_over = False

    def get_sensors(self):
        # 20 normalized inputs:
        # 1-2: Normalized Rocket Position [x, y] in [0, 1]
        # 3-4: Normalized Rocket Velocity [vx, vy]
        # 5-8: Wall Clearances [left, right, top, bottom]
        # 9-16: 8-ray radar raycast distances
        # 17-20: Primary Threat relative dx, dy, rel_vx, rel_vy
        rx = self.rocket.pos.x
        ry = self.rocket.pos.y
        vx = self.rocket.vel.x
        vy = self.rocket.vel.y

        norm_pos = [rx / 800.0, ry / 600.0]
        norm_vel = [vx / 5.2, vy / 5.2]
        wall_clearances = [
            (rx - 24.0) / 752.0,
            (776.0 - rx) / 752.0,
            (ry - 24.0) / 552.0,
            (576.0 - ry) / 552.0
        ]

        radar_ranges = [1.0] * 8
        radar_horizon = 180.0

        for t in self.threats:
            dx = t.pos.x - rx
            dy = t.pos.y - ry
            dist = math.hypot(dx, dy)
            if dist < radar_horizon and dist > 0.001:
                angle = (math.atan2(dy, dx) + math.pi * 2) % (math.pi * 2)
                ray_idx = int((angle + math.pi / 8) / (math.pi / 4)) % 8
                norm_d = dist / radar_horizon
                if norm_d < radar_ranges[ray_idx]:
                    radar_ranges[ray_idx] = norm_d

        # Primary threat (closest)
        min_dist = float('inf')
        closest_t = None
        for t in self.threats:
            d = math.hypot(t.pos.x - rx, t.pos.y - ry)
            if d < min_dist:
                min_dist = d
                closest_t = t

        if closest_t and min_dist < 300.0:
            rel_threat = [
                (closest_t.pos.x - rx) / 300.0,
                (closest_t.pos.y - ry) / 300.0,
                (closest_t.vel.x - vx) / 10.0,
                (closest_t.vel.y - vy) / 10.0
            ]
        else:
            rel_threat = [0.0, 0.0, 0.0, 0.0]

        return norm_pos + norm_vel + wall_clearances + radar_ranges + rel_threat

    def step(self, network=None):
        if self.game_over:
            return

        self.ticks += 1

        # Query Neural Network Controller
        if network:
            sensors = self.get_sensors()
            outputs = network.feedforward(sensors)
            # Motor mapping: net_x = out[1] - out[0], net_y = out[3] - out[2]
            tx = outputs[1] - outputs[0]
            ty = outputs[3] - outputs[2]
            self.rocket.set_throttle(tx, ty)

        self.rocket.update()

        # Threat Spawning (roughly every 40-70 ticks)
        if self.ticks % 45 == 0 and len(self.threats) < 14:
            side = self.rng.randint(0, 3)
            speed = self.rng.uniform(2.5, 4.5)
            if side == 0: # Left
                sx, sy = -20.0, self.rng.uniform(50.0, 550.0)
                angle = self.rng.uniform(-0.5, 0.5)
            elif side == 1: # Right
                sx, sy = 820.0, self.rng.uniform(50.0, 550.0)
                angle = math.pi + self.rng.uniform(-0.5, 0.5)
            elif side == 2: # Top
                sx, sy = self.rng.uniform(50.0, 750.0), -20.0
                angle = math.pi / 2 + self.rng.uniform(-0.5, 0.5)
            else: # Bottom
                sx, sy = self.rng.uniform(50.0, 750.0), 620.0
                angle = -math.pi / 2 + self.rng.uniform(-0.5, 0.5)

            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            self.threats.append(Threat(sx, sy, vx, vy, radius=self.rng.uniform(14.0, 24.0)))

        # Update Threats & Check Collisions
        active_threats = []
        rx, ry = self.rocket.pos.x, self.rocket.pos.y

        for t in self.threats:
            t.update()
            dist = math.hypot(t.pos.x - rx, t.pos.y - ry)

            # Near-miss bonus tracking
            if dist < 45.0 and dist > (t.radius + self.rocket.radius):
                self.rocket.near_misses += 1

            # Collision check
            if dist < (t.radius + self.rocket.radius):
                self.rocket.shields -= 1
                if self.rocket.shields <= 0:
                    self.rocket.alive = False
                    self.game_over = True
                    break

            # Boundary cull
            if -60.0 < t.pos.x < 860.0 and -60.0 < t.pos.y < 660.0:
                active_threats.append(t)

        self.threats = active_threats
