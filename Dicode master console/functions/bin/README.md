Place your static `ffmpeg` binary in this directory before deploying:

```
functions/
  bin/
    ffmpeg        # executable
```

The Cloud Function automatically sets `FFMPEG_PATH` to this file if present. You can swap in a different build (e.g. ARM64) as long as the executable bit is set.

