#!/bin/sh
# Generates the fake camera and mic used by tests/ (gitignored: the .y4m is ~67 MB).
# 6 s loop of 960x540 SMPTE bars at 15 fps with a running timecode, plus a 1 kHz tone.
set -e
cd "$(dirname "$0")"
mkdir -p media
FONT=/System/Library/Fonts/Supplemental/Arial\ Bold.ttf
ffmpeg -v error -y -f lavfi -i "smptebars=size=960x540:rate=15:duration=6" -vf \
  "drawtext=fontfile='$FONT':text='EDIT BAY  -  SIMULATED OBS OUTPUT':fontsize=40:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-tw)/2:y=40,\
drawtext=fontfile='$FONT':timecode='01\:00\:00\:00':rate=15:fontsize=56:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6:x=(w-tw)/2:y=h-110" \
  -pix_fmt yuv420p media/bars.y4m
ffmpeg -v error -y -f lavfi -i "sine=frequency=1000:sample_rate=48000:duration=6" -ac 1 media/tone.wav
ls -lh media
