#!/usr/bin/env python3
"""
Convert Keras model to TensorFlow.js format for browser use.

Usage:
  pip install tensorflowjs tensorflow
  python convert_model.py
"""

import os
import sys

try:
    import tensorflow as tf
    import tensorflowjs as tfjs
except ImportError:
    print("Please install dependencies:")
    print("  pip install tensorflowjs tensorflow")
    sys.exit(1)

# Paths
INPUT_MODEL = "public/drone_model.keras"
OUTPUT_DIR = "public/models/drone_classifier"

def main():
    print(f"Loading model from: {INPUT_MODEL}")
    
    # Load the Keras model
    model = tf.keras.models.load_model(INPUT_MODEL)
    
    # Print model summary
    print("\nModel Summary:")
    model.summary()
    
    # Get input/output info
    print(f"\nInput shape: {model.input_shape}")
    print(f"Output shape: {model.output_shape}")
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Convert to TensorFlow.js format
    print(f"\nConverting to TensorFlow.js format...")
    tfjs.converters.save_keras_model(model, OUTPUT_DIR)
    
    print(f"\nModel saved to: {OUTPUT_DIR}")
    print("Files created:")
    for f in os.listdir(OUTPUT_DIR):
        size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
        print(f"  - {f} ({size:,} bytes)")
    
    # Generate model config for the app
    config = {
        "inputShape": list(model.input_shape[1:]),  # Remove batch dimension
        "outputShape": list(model.output_shape[1:]),
        "modelPath": f"/{OUTPUT_DIR.replace('public/', '')}/model.json",
    }
    
    print(f"\nModel config for app:")
    print(f"  inputShape: {config['inputShape']}")
    print(f"  outputShape: {config['outputShape']}")
    print(f"  modelPath: {config['modelPath']}")

if __name__ == "__main__":
    main()
