#!/usr/bin/env python3
"""Test script to verify FastAPI application structure."""

import sys

def main():
    print("Testing FastAPI application...")
    print("=" * 50)
    
    try:
        from app.main import app
        
        print("✓ FastAPI app imported successfully")
        
        # Test 1: Verify app structure
        print("\nTest 1: Verify app structure")
        assert app.title == "Whisper Transcription Service", "App title incorrect"
        print(f"  ✓ Title: {app.title}")
        print(f"  ✓ Version: {app.version}")
        
        # Test 2: Verify endpoints exist
        print("\nTest 2: All required endpoints exist")
        routes = {route.path for route in app.routes}
        required_routes = ["/", "/health", "/transcribe", "/cache"]
        for route in required_routes:
            assert route in routes, f"Route {route} not found"
            print(f"  ✓ {route}")
        
        # Test 3: Verify middleware
        print("\nTest 3: Middleware configured")
        middleware_classes = [m.cls.__name__ for m in app.user_middleware]
        assert "CORSMiddleware" in middleware_classes, "CORS middleware not found"
        print(f"  ✓ CORS middleware configured")
        
        # Test 4: Verify startup event registered
        print("\nTest 4: Startup event registered")
        assert len(app.router.on_startup) > 0, "No startup events registered"
        print(f"  ✓ {len(app.router.on_startup)} startup event(s) registered")
        
        print("\n" + "=" * 50)
        print("SUCCESS: FastAPI application structure correct!")
        print("\nNOTE: Full transcription testing requires audio files.")
        print("Run: uvicorn app.main:app --reload to start the server.")
        return 0
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 50)
        print("FAILED: FastAPI application test failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
