
# Everdice 🎲

*A lightweight engine for simulating tabletop RPG dice rolls and rulesets*

## Overview

**Everdice** is a modular, Python-based dice-rolling and rules-processing engine designed for tabletop role-playing games (TTRPGs). Inspired by classic fantasy RPG mechanics, it allows developers, dungeon masters, and players to simulate dice rolls, define custom rulesets, and build flexible game logic on top of a clean and extensible core.

Whether you're building a new TTRPG, automating a campaign, or just want to explore probability and gameplay mechanics, Everdice offers a streamlined backend to get rolling fast.

---

## Features

* 🎲 **Standard and custom dice mechanics** (`d4`, `d6`, `d20`, etc.)
* 📜 **Rule parsing engine** for modifiers, rerolls, and complex outcomes
* 🧠 **Character and stats models** (e.g., for ability checks, saving throws)
* 🔧 **Extensible design** for integrating with GUI apps or Discord bots
* 🧪 **Testable architecture** with clean separation of logic
* 💻 **Python-native** and easy to integrate into other projects

---

## Installation

Clone the repo and install locally:

```bash
git clone https://github.com/dkoepsell/Everdice.git
cd Everdice
pip install -r requirements.txt
```

> ⚠️ Currently under development — expect frequent changes.

---

## Basic Usage

```python
from everdice import DiceRoller

roller = DiceRoller()
result = roller.roll("2d6 + 3")

print(f"Result: {result.total} (Details: {result.breakdown})")
```

Supports:

* Simple rolls (`d20`, `2d8+1`)
* Advantage/disadvantage mechanics
* Critical hit rules
* Conditional effects and outcomes (via modifiers)

---

## Project Structure

```
everdice/
├── core/               # Core dice and rules logic
├── models/             # Game models like characters, stats, conditions
├── rulesets/           # Modular rule definitions (e.g., D&D 5e)
├── tests/              # Unit tests
└── examples/           # Example scripts and usage
```

---

## Roadmap

* [x] Basic dice parsing and rolling
* [x] Roll modifiers and arithmetic logic
* [ ] Full support for D\&D 5e mechanics
* [ ] Integration with game UIs and web apps
* [ ] Campaign manager support
* [ ] Multiplayer log and state management

---

## Contributing

Contributions are welcome! Please fork the repo and submit a pull request. For significant changes, open an issue to discuss ideas and proposed features.

---

## License

MIT License © 2025 David Koepsell

---

## Acknowledgments

Thanks to the open-source RPG and tabletop community for ongoing inspiration and the design of intuitive, rule-based systems that make engines like this possible.

---

Let me know if you’d like to tailor this more to a particular game system or integrate visuals/mockups.
