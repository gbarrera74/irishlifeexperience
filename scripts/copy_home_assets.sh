#!/usr/bin/env bash
# Copy the home page's images out of the WordPress uploads and downscale them.
# Originals are camera-sized (several MB each); these are display sizes.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=export/uploads
mkdir -p public/images/home public/images/partners

find_one() {  # locate a file by basename, preferring the true original
  find "$SRC" -type f -name "$1" 2>/dev/null | head -1
}

copy() {      # copy <basename> <dest> <max-dimension>
  local src dest
  src="$(find_one "$1")"
  if [ -z "$src" ]; then echo "  MISSING  $1"; return; fi
  dest="$2"
  sips -Z "$3" "$src" --out "$dest" >/dev/null 2>&1
  printf "  %-52s -> %s (%s)\n" "$1" "$dest" "$(du -h "$dest" | cut -f1)"
}

echo "hero slideshow:"
# The kit records .jpg names, but the files on disk are the .jpeg re-uploads.
copy "IMG_1879-2-scaled-1.jpeg"                                public/images/home/hero-1.jpg 2000
copy "30727297_10155840810949130_8651115417584009216_o.jpeg"   public/images/home/hero-2.jpg 2000
# Slide 3 is a photograph saved as PNG (5.7 MB); JPEG is the right container.
sips -s format jpeg -Z 2000 "$(find_one 'A83E2C8F-18C2-4948-AA99-583FD34C59B7.png')" \
  --out public/images/home/hero-3.jpg >/dev/null 2>&1 && echo "  hero-3.jpg (converted from PNG)"
copy "IMG_2820-scaled.jpg"                                     public/images/home/hero-4.jpg 2000

echo "audience cards:"
copy "IMG_3301-scaled.jpg" public/images/home/card-program.jpg  1200
copy "IMG_1749-scaled.jpg" public/images/home/card-students.jpg 1200
copy "IMG_2063-scaled.jpg" public/images/home/card-parents.jpg  1200
copy "IMG_1979-scaled.jpg" public/images/home/card-alumni.jpg   1200

echo "welcome + video background:"
copy "IMG_8282-scaled.jpg"     public/images/home/failte.jpg    1400
copy "IMG_2287-scaled-1.jpeg"  public/images/home/video-bg.jpg  2000
copy "IMG_2287-scaled.jpg"     public/images/home/video-bg.jpg  2000

echo "partners:"
for f in ILE-Logo-1.jpg goblue.png juniper.png landmark.png \
         goinspired.png irishamericansociety.png oconnor.png quest.png; do
  ext="${f##*.}"
  name="$(echo "${f%.*}" | tr '[:upper:]' '[:lower:]')"
  copy "$f" "public/images/partners/${name}.${ext}" 400
done
