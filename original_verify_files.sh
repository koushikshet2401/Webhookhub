#!/bin/bash
 Run this from your webhookhub repo root: bash verify-files.sh

 Checks every file that should exist actually does, and flags anything
 missing or suspiciously empty (under 50 bytes - real implementation
 files in this project are all well over that). This exists specifically
to settle "is a file actually missing, or did something else go wrong"
 without more guessing.

