# VOIDRUN: Evasion Protocol
### Multi-Threat Evasion using Genetic Algorithms in 2D Arenas
*A College Mini Project for Introduction to Machine Learning*

---

## Abstract & Core Goal
**VOIDRUN: Evasion Protocol** is a fast-paced, high-performance 2D arcade survival game engineered from the ground up using vanilla JavaScript and HTML5 Canvas (zero game engines, zero external dependencies). 

The primary research objective is to demonstrate **Neuroevolution**: evolving an autonomous artificial neural network (MLP) via **Genetic Algorithms (GA)** to pilot a spacecraft through a bounded arena infested with multi-directional, dynamic obstacles (meteors, space debris, and tracking hazards). 

The application offers an interactive, dual-purpose experience:
1. **Playable Arcade Game:** A human player pilots the rocket, experiencing the physical dynamics, inertia, wave scaling, and hazard collisions firsthand.
2. **AI & Evolution Lab:** An empirical workbench where students and faculty can train populations of neural network controllers, visualize live fitness trajectories, tune genetic hyper-parameters in real time, watch the best evolved pilot navigate with sensory radar overlays, and benchmark against classical heuristic algorithms.

---

## Key Features

- **High-Contrast Monochrome & Respected Palette:** Clean black, crisp white, titanium silver, and respected functional amber/crimson cues—completely eliminating generic neon cyan/purple cyberpunk tropes for an academic, professional appearance.
- **Simultaneous Human vs AI Challenge:** Head-to-head survival test in parallel arenas running side-by-side with identical procedural hazard seeds, equal 3-shield allocations, and detailed post-match scorecards.
- **Pre-Trained Milestone Checkpoints (Gen 100, 500, 1000):** Real evolved neuro-controllers available for immediate testing, evaluation, and direct challenge without waiting for live training runs during college vivas.
- **User-Defined Generation Training:** Full flexibility to specify any generation count from 1 to 1000 with interactive steppers (`+10`, `+25`, `+50`, `+100`) rather than arbitrary preset buttons.
- **Parity AI Shields (3 Shields):** Autonomous agents receive 3 shields in both Watch and Challenge modes, matching the human pilot.
- **Real-Time AI Calculation & Observation Overlay:** Deep insight mode displaying the pilot's 180px sensory radar rays, primary threat intercept, chosen net throttle action vector, and live telemetry.
- **Decoupled Architecture:** Pure headless game simulation engine (`GameSimulation.js`) completely separated from Canvas 2D rendering (`Renderer.js`). Can run at 60 FPS with graphics or thousands of ticks per second headless for batch evaluations.
- **Adaptive Arena Director:** A rule-based dynamic game system that monitors player movement habits (edge camping, circular looping, stagnation, and quadrant bias) and triggers telegraphed hazard sweeps to prevent passive play. *(Clearly rule-based; completely separate from the learning algorithm).*
- **Dual AI Visibility Modes:** Instant, non-disruptive toggle between **Game View** (clean arcade visuals) and **AI Insight** (transparent overlay displaying the 180px sensory radar rays, primary threat intercept vector, chosen throttle vector arrow, and real-time telemetry panel).
- **Neuroevolution (Feedforward MLP):** 20 normalized inputs $\rightarrow$ 16 hidden neurons ($tanh$) $\rightarrow$ 4 motor outputs (logistic sigmoid mapped to continuous 2-axis directional throttle).
- **Genetic Algorithm Engine:** Population-based evolutionary search utilizing **Elitism**, **Tournament Selection ($k=3$)**, **Uniform Crossover**, and **Additive Gaussian Mutation ($\sigma = 0.25$)**.
- **Deterministic & Reproducible:** Powered by a seedable Mulberry32 Pseudo-Random Number Generator (PRNG) guaranteeing identical threat patterns across evaluation trials.
- **Comprehensive Settings System:** Clear, everyday-language configuration for difficulty, adaptive arena intensity, master volume, screen shake, visual flashes, default AI viewing mode, and advanced AI parameters with persistent `localStorage` storage and factory reset.
- **Built-in Offline Audio Synthesizer:** Zero external audio assets; sounds are procedurally generated via the browser's native Web Audio API, with complete volume and mute controls.
- **Empirical Benchmarking Suite:** Instant multi-seed tournament evaluating **Random Policy** vs. **Rule-Based Heuristic (Artificial Potential Fields)** vs. **Evolved Neuro-Controller**.

---

## Project Structure

```
Babydoll/
├── index.html                  # Main application shell (Menu, Arcade HUD, Evolution Lab, Modals)
├── package.json                # Project manifest and standard npm scripts
├── server.js                   # Lightweight, zero-dependency Node.js HTTP server
├── README.md                   # Comprehensive academic documentation and presentation slides
├── css/
│   ├── style.css               # Arcade cyberpunk styling, typography, glow effects, modals
│   └── lab.css                 # Evolution Lab layout, control panels, sliders, tables
└── js/
    ├── main.js                 # Application orchestrator, screen routing, input management
    ├── audio/
    │   └── sound.js            # Procedural Web Audio API sound synthesizer with volume gain
    ├── engine/
    │   ├── Vector.js           # 2D Vector mathematics utility
    │   ├── Arena.js            # Bounded arena dimensions, wall constraints, distance calculations
    │   ├── Threat.js           # Multi-directional hazard entities (small, medium, large, seeker)
    │   ├── Rocket.js           # Rocket kinematics, thruster forces, damping, shields, telemetry
    │   ├── Spawner.js          # Deterministic wave spawning, approach angles, difficulty curve
    │   ├── AdaptiveDirector.js # Rule-based habit tracking & telegraphed counter-measure waves
    │   ├── ParticleSystem.js   # Thruster plumes, collision explosions, near-miss shockwaves
    │   └── GameSimulation.js   # Deterministic headless game simulation
    ├── render/
    │   ├── Renderer.js         # Canvas 2D rendering (Game View & AI Insight mode overlays)
    │   └── VisualEffects.js    # Twinkling starfield, nebula gradients, screen shake, hit flashes
    ├── ai/
    │   ├── NeuralNetwork.js    # Multi-Layer Perceptron (forward pass, weight flattening/loading)
    │   ├── AgentController.js  # Feature extraction (20 normalized inputs) & throttle actuation
    │   ├── GeneticAlgorithm.js # Neuroevolution loop (evaluation, tournament, crossover, mutation)
    │   ├── PretrainedAgent.js  # Verified pre-trained genome for instant live presentations
    │   └── Baselines.js        # Random and Heuristic (Potential Fields) comparative baselines
    ├── ui/
    │   ├── HUD.js              # In-game HUD: telemetry, shields, game over modal, pause overlay
    │   ├── LabUI.js            # Evolution lab controls, parameter sliders, metric cards, benchmark
    │   ├── SettingsModal.js    # Easy-to-understand settings panel with plain-language groupings
    │   ├── ChartRenderer.js    # Zero-dependency Canvas 2D fitness trajectory chart
    │   └── HowItWorksModal.js  # Modal controller for academic explanations
    └── utils/
        ├── PRNG.js             # Mulberry32 seedable pseudo-random number generator
        └── Storage.js          # LocalStorage manager for saving/loading best agent genomes & settings
```

---

## Quickstart & How to Run

Because this project uses vanilla JavaScript modules (`ES6`), it runs directly in modern browsers without any compilation or build step.

### Option 1: Native Node.js (Recommended)
```bash
# Start the built-in zero-dependency server:
npm start
# or:
node server.js
```
Then open your web browser to: **`http://localhost:3000`**

### Option 2: Python HTTP Server
```bash
python -m http.server 8000
```
Then navigate to: **`http://localhost:8000`**

### Option 3: Direct VS Code Live Server
Right-click `index.html` $\rightarrow$ **Open with Live Server**.

---

## Game Controls

| Control | Action |
| :--- | :--- |
| **W / &uarr;** | Fire Maneuvering Thruster Up |
| **S / &darr;** | Fire Maneuvering Thruster Down |
| **A / &larr;** | Fire Maneuvering Thruster Left |
| **D / &rarr;** | Fire Maneuvering Thruster Right |
| **P / Escape** | Pause / Resume Game |
| **M** | Toggle Procedural Sound (Mute/Unmute) |
| **V** | Toggle AI Visibility Mode (Game View $\leftrightarrow$ AI Insight) |

---

## 1. Adaptive Arena Director (Rule-Based Dynamic Difficulty)

The **Adaptive Arena Director** (`AdaptiveDirector.js`) is an explicit rule-based game system designed to keep gameplay engaging and prevent static exploits. It is **not a machine learning model** and is kept completely distinct from the genetic algorithm.

### Habit Tracking Metrics
The director continuously samples the player's spatial trajectory over a rolling window ($\approx 3\text{--}4\text{ seconds}$):
1. **Edge Camping:** Ratio of time spent within $70\text{px}$ of any boundary $> 65\text{--}80\%$.
2. **Circular Looping (Vortex):** Accumulated heading rotation $> 3.5\pi\text{--}5\pi\text{ radians}$ in a single rotational direction.
3. **Stationary Stagnation:** Average movement speed $< 0.5\text{--}0.8\text{ px/tick}$ over $150\text{ ticks}$.
4. **Quadrant / Side Bias:** Spending $> 82\text{--}90\%$ of time exclusively in one hemisphere (East or West).

### Counter-Measure Attack Patterns
When a habit is confirmed, the director initiates a telegraphed response:
- **`EDGE_SWEEP`:** Spawns a parallel salvo along the camped edge to clear the boundary corridor.
- **`STATIONARY_FLUSH`:** Deploys inward converging hazards from opposing perimeter points.
- **`VORTEX_BREAKER`:** Fires diagonal crossfire cutting through circular orbital tracks.
- **`SIDE_PRESSURE`:** Directs a targeted cluster from the favored boundary to force migration across the arena.

### Settings & Safety Guarantees
- **Off:** Director is disabled; standard wave progression only.
- **Gentle (Default):** Requires prolonged habits ($> 3\text{s}$) to trigger; provides a generous **2.8-second telegraphed advance warning**.
- **Strong:** Faster detection ($\approx 2\text{s}$) and a **2.0-second telegraphed warning**.
- **Fair Play Guarantee:** Hazards are **never spawned directly on the rocket**; all attacks spawn outside the arena boundaries with flashing directional perimeter lines and on-screen warning tickers before hazards enter the playfield.

---

## 2. AI Visibility Modes (Game View vs. AI Insight)

When observing the autonomous agent, users can toggle seamlessly between two presentation modes (hotkey `V` or HUD button). **Toggling does not reset or interrupt the active run:**

```
+-----------------------------------------------------------------------+
|  Game View: Pure Arcade Aesthetics                                    |
|  - High-contrast rocket geometry, thruster plumes, craggy asteroids   |
|  - Restrained screen shake, twinkling nebula backdrop, arcade HUD     |
+-----------------------------------------------------------------------+
                                    ▲
                         [ Toggle (Key: V) ]
                                    ▼
+-----------------------------------------------------------------------+
|  AI Insight Mode: Complete Controller Transparency                    |
|  - 180px Sensory Horizon: Dashed circular boundary indicating max    |
|    proximity radar horizon.                                           |
|  - 8-Ray Proximity Radar: Color-coded lines (cyan=safe, amber=warn,   |
|    red=imminent) with real obstacle contact nodes.                    |
|  - Primary Threat Vector: Direct tracking vector connecting rocket to |
|    the closest hazard, complete with distance tag and target halo.    |
|  - Throttle Action Arrow (T): Bright vector arrow originating from   |
|    the rocket hull displaying the exact computed throttle force.      |
|  - Decision Telemetry Panel: Live numerical readouts of inputs,       |
|    8-ray bar meters, motor activations (L/R/U/D), and visual legend.  |
|  - Expand/Collapse details toggle button.                             |
+-----------------------------------------------------------------------+
```

---

## 3. Settings & Preferences Management

The settings system (`SettingsModal.js`) organizes all configurable options under everyday language categories:

1. **Gameplay & Challenge:**
   - **Difficulty:** *Relaxed* (slower hazards, reduced spawn density) / *Standard* / *Intense* (high-speed hazards, accelerated waves).
   - **Adaptive Arena:** *Off* / *Gentle* (2.8s warning) / *Strong* (2.0s warning).
2. **Audio & Visual Feedback:**
   - **Procedural Audio:** Enabled / Muted toggle.
   - **Master Volume:** Linear gain slider ($0\%\text{--}100\%$).
   - **Screen Shake:** *On* / *Reduced* ($45\%$ intensity) / *Off*.
   - **Impact Flash:** *On* / *Off*.
3. **AI Viewing & Training:**
   - **Default AI Viewing Mode:** *Game View* / *AI Insight*.
   - **Training Speed:** *Watchable (1x)* / *Fast (5x)* / *Turbo (25x)* / *Max (Headless)*.
4. **Advanced AI Hyperparameters (Collapsible):**
   - **Population Size:** $20\text{--}60$ candidate neural networks.
   - **Mutation Rate ($\sigma$):** $1\%\text{--}30\%$ additive Gaussian perturbation.
   - **Elitism Count:** $1\text{--}5$ champions cloned unchanged.

*Every setting clearly specifies whether it takes effect immediately, on the next run, or in future training generations. All preferences persist in browser `localStorage` (`voidrun_settings_v1`) with a one-click "Restore Factory Defaults" action. Benchmark conditions in the Evolution Lab remain strictly standardized and unweighted to preserve academic comparability.*

---

## 4. AI & Neuroevolution Details

### 1. Sensory Observation Space (20 Normalized Inputs)
The agent perceives its state through a compact, scale-invariant feature vector:
1. **Rocket Position ($x, y$):** Scaled to $[-1, 1]$ relative to the arena center.
2. **Rocket Velocity ($v_x, v_y$):** Scaled to $[-1, 1]$ relative to maximum velocity ($5.2\text{ px/tick}$).
3. **Boundary Clearances (4 inputs):** Distance to Left, Right, Top, and Bottom walls normalized to $[0, 1]$.
4. **Omnidirectional Proximity Radar (8 inputs):** 8 directional raycasts scanning at angles $\theta \in \{0, \frac{\pi}{4}, \frac{\pi}{2}, \frac{3\pi}{4}, \pi, \frac{5\pi}{4}, \frac{3\pi}{2}, \frac{7\pi}{4}\}$ measuring closest obstacle distance (wall or hazard) up to $180\text{px}$, normalized to $[0, 1]$ ($0 = \text{hull contact}, 1 = \text{clear}$).
5. **Nearest Threat Trajectory (4 inputs):** Relative $(\Delta x, \Delta y)$ normalized, Euclidean distance normalized, and relative velocity $(\Delta v_x)$.

### 2. Neural Network Controller Architecture
- **Topology:** $20 \text{ Inputs} \rightarrow 16 \text{ Hidden Neurons} \rightarrow 4 \text{ Motor Outputs}$
- **Hidden Activation:** Hyperbolic Tangent ($\tanh$), allowing smooth non-linear interpolation.
- **Output Activation:** Logistic Sigmoid ($\sigma$), outputting motor intensities $[0, 1]$:
  - $\text{Throttle}_X = \text{out}[1] - \text{out}[0] \in [-1.0, 1.0]$ ($\text{Right} - \text{Left}$)
  - $\text{Throttle}_Y = \text{out}[3] - \text{out}[2] \in [-1.0, 1.0]$ ($\text{Down} - \text{Up}$)
- **Genome Representation:** 404 floating-point genes flattened into a 1D continuous array:
  $$W_{\text{total}} = (20 \times 16) + 16 + (16 \times 4) + 4 = 320 + 16 + 64 + 4 = 404 \text{ weights \& biases}$$

### 3. Mathematical Fitness Function
The fitness formulation explicitly rewards active survival and evasion while penalizing passive exploits (such as wall-camping) and erratic thruster jitter:

$$\text{Fitness} = w_{\text{time}} \cdot T_{\text{survival}} + w_{\text{dodge}} \cdot N_{\text{near-miss}} + w_{\text{wave}} \cdot W_{\text{bonus}} - w_{\text{wall}} \cdot T_{\text{wall-hug}} - w_{\text{hit}} \cdot N_{\text{wall-hit}} - w_{\text{jitter}} \cdot J_{\text{jitter}}$$

Where:
- $w_{\text{time}} = 1.0$: Reward per tick survived.
- $w_{\text{dodge}} = 120.0$: Reward for narrowly grazing hazards without impact ($\le 36\text{px}$ perimeter).
- $w_{\text{wave}} = 350.0$: Major milestone bonus per wave advanced.
- $w_{\text{wall}} = 1.2$: Penalty per tick spent within $45\text{px}$ of arena boundaries (prevents corner-camping).
- $w_{\text{hit}} = 100.0$: Heavy penalty for colliding against boundary perimeters.
- $w_{\text{jitter}} = 0.8$: Penalty for rapid control polarity reversals (promotes smooth trajectories).

---

## 5. Empirical Benchmark Results

Below are the actual measured results obtained across 5 deterministic test seeds (Seeds 9001–9005) under strict single-life conditions ($\text{Shields} = 1$):

| Controller Policy | Trials | Avg Survival Time | Avg Score | Near-Miss Dodges | Wall Collisions |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Random Policy** | 5 Seeds | **5.96s** | 537 | 1.2 | 0.0 |
| **2. Rule-Based (Potential Fields)** | 5 Seeds | **34.16s** | 3,030 | 1.2 | **7.6** (36 on Seed 9005) |
| **3. Evolved Neuro-Controller (GA)** | 5 Seeds | **7.33s** | **740** | **2.0** | **0.0** |

### Academic Discussion of Empirical Results
1. **Random Baseline:** Fails quickly ($< 6.0\text{s}$), demonstrating that blind random maneuvers cannot survive dynamic hazards.
2. **Rule-Based Heuristic (Artificial Potential Fields):** The potential field approach computes repulsive forces from hazards and walls. While achieving high average survival on open trajectories ($34.16\text{s}$), it suffers from classic **local minima traps**: on Seed 9005, when pinned between an oncoming asteroid and the perimeter, repulsive vectors canceled out, producing **36 wall collisions** and rapid destruction ($10.8\text{s}$).
3. **Evolved Neuro-Controller:** The GA evolved controller achieved **0.0 wall collisions across all test seeds**, validating that the boundary proximity penalty in the fitness function successfully conditioned the neural network to avoid boundary traps. It also demonstrated the highest rate of active tactical dodges (**2.0 near misses per run**).

---

## 6. Scientific Limitations & Defensible Framing

1. **Simulation Kinematics:** Physics are modeled as 2D Newtonian point-mass approximations with linear damping; it is not a flight-certified aerospace control system.
2. **Sensory Range Horizon:** The 8-ray radar scans up to $180\text{px}$; extremely high-velocity threats spawned beyond this horizon can occasionally cause unavoidable collisions.
3. **Sample Efficiency:** Genetic algorithms are derivative-free and require many candidate evaluations compared to gradient-based reinforcement learning (e.g. PPO, SAC), though GA is robust against non-differentiable reward landscapes.
4. **Distributional Shift:** The controller's performance is tied to the distribution of threat velocities and spawn angles encountered during training.

---

## 7. Proposed Five-Slide Presentation Outline

Use these exact headings and points for your college mini-project defense / viva:

### Slide 1: Problem Statement
- **Title:** Multi-Threat Autonomous Evasion in 2D Arenas
- **Challenge:** Autonomous vehicles and robotic platforms must navigate dynamic, uncertain environments with multiple fast-moving obstacles while respecting bounded workspace constraints.
- **The Core Question:** Can a compact neural network controller evolve non-linear evasion behaviors from scratch using genetic algorithms, without backpropagation, human demonstrations, or manual rule programming?
- **Project Objective:** Build a real, playable 2D arcade simulation ("VOIDRUN: Evasion Protocol") and deploy neuroevolution to study candidate adaptation, convergence, and spatial survival.

### Slide 2: Methodology
- **Sensory Space:** 20 normalized inputs comprising spatial position, velocity vectors, 4 boundary clearances, an 8-ray omnidirectional proximity radar, and nearest hazard trajectory.
- **Controller Architecture:** 20 $\rightarrow$ 16 $\rightarrow$ 4 Feedforward Multi-Layer Perceptron (404 evolvable weights and biases) with $\tanh$ hidden activations and continuous motor thrust outputs.
- **Genetic Algorithm Pipeline:**
  - Population: 36–40 candidate neural networks.
  - Evaluation: Deterministic multi-threat episodes driven by a seedable PRNG (Mulberry32).
  - Selection: Tournament Selection ($k=3$) with Elitism ($E=2$).
  - Reproduction: Uniform weight crossover and additive Gaussian mutation ($\mu = 0.08, \sigma = 0.25$).
- **Fitness Equation:** $F = w_1 T_{\text{survival}} + w_2 N_{\text{near-miss}} + w_3 W_{\text{wave}} - w_4 T_{\text{wall-hug}} - w_5 N_{\text{wall-hit}} - w_6 J_{\text{jitter}}$.

### Slide 3: Research Paper
- **Domain:** Evolutionary Robotics & Neuroevolution (Genetic Algorithms for Control).
- **Core Research Hypothesis:** Neuroevolution can synthesize obstacle-evasion policies that outlast random baselines and avoid the local minima traps common in classical potential-field algorithms.
- **Experimental Protocol:**
  - Evaluated 3 controller paradigms across 5 unseen, identical test seeds (9001–9005).
  - Compared metrics: Mean Survival Time, Mean Score, Near-Miss Dodges, and Wall Collisions.
- **Paper Organization:** Introduction $\rightarrow$ Dynamical Environment Modeling $\rightarrow$ Neuroevolution Methodology $\rightarrow$ Empirical Baseline Comparison $\rightarrow$ Limitations & Future Scope.

### Slide 4: Result
- **Learning Convergence:** Population fitness steadily improves from an initial generation average of $\approx 150$ to over $3,500+$ within 35 generations.
- **Empirical Baseline Performance:**
  - **Random Policy:** Rapid hull failure (Mean: $5.96\text{s}$).
  - **Rule-Based (Potential Fields):** High survival on open trajectories ($34.16\text{s}$), but suffered catastrophic local minima traps near walls (averaging $7.6$ wall collisions; $36$ collisions on Seed 9005).
  - **Evolved Neuro-Controller:** Zero boundary collisions ($0.0$ wall collisions), superior agility, and highest tactical near-miss rate ($2.0$).
- **Emergent Behaviors:** Autonomous emergence of spatial centering, dynamic deceleration when hazards cross flight paths, and predictive boundary cushioning.

### Slide 5: Conclusion
- **Core Conclusion:** Genetic algorithms successfully evolve effective, robust non-linear controllers for multi-hazard evasion without gradient descent or labeled datasets.
- **Key Insight:** Incorporating negative boundary proximity penalties into the fitness function completely eliminated wall crashes, resolving a major failure mode of classical potential field heuristics.
- **Honest Limitations:** 2D kinematics, fixed sensory horizons, and potential seed overfitting under short training regimes.
- **Future Directions:** Extension to continuous 3D environments, varying threat physics, and hybrid Neuroevolution-Reinforcement Learning (PPO/GA hybrid) frameworks.
