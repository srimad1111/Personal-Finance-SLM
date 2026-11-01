"""Environment Verification Script for SLM Training & Inference."""
import sys
import platform

def verify_environment():
    print("=" * 60)
    print("SLM Model Development Environment Verification")
    print("=" * 60)
    print(f"Python Version    : {platform.python_version()}")
    print(f"Architecture      : {platform.architecture()[0]}")
    print(f"Operating System  : {platform.system()} {platform.release()}")
    print("-" * 60)

    try:
        import torch
        print(f"PyTorch Version   : {torch.__version__}")
        print(f"CUDA Available    : {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"Device Name       : {torch.cuda.get_device_name(0)}")
            print(f"VRAM Allocated    : {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    except ImportError:
        print("PyTorch           : Not yet installed in active environment.")

    try:
        import transformers
        print(f"Transformers      : {transformers.__version__}")
    except ImportError:
        print("Transformers      : Not yet installed in active environment.")

    try:
        import peft
        print(f"PEFT              : {peft.__version__}")
    except ImportError:
        print("PEFT              : Not yet installed in active environment.")

    try:
        import gguf
        print(f"GGUF              : {gguf.__version__}")
    except ImportError:
        print("GGUF              : Not yet installed in active environment.")

    print("=" * 60)

if __name__ == "__main__":
    verify_environment()

