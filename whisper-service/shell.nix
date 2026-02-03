{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python312
    python312Packages.pip
    python312Packages.virtualenv
    
    # System dependencies for audio processing
    zlib
    libsndfile
    ffmpeg
    
    # For PyAV and other C extensions
    stdenv.cc.cc.lib
  ];
  
  shellHook = ''
    # Set up library paths for C extensions
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [
      pkgs.stdenv.cc.cc
      pkgs.zlib
      pkgs.libsndfile
      pkgs.ffmpeg
    ]}''${LD_LIBRARY_PATH:+:}$LD_LIBRARY_PATH"
    
    echo "Whisper Service Development Environment"
    echo "======================================="
    echo "Python: $(python --version)"
    echo ""
    echo "To activate venv: source venv/bin/activate"
    echo "To run test: python test_model_load.py"
  '';
}
