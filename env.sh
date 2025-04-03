#!/bin/sh

# Recreate config file
rm -rf /usr/share/nginx/html/config.js
touch /usr/share/nginx/html/config.js

# Add assignment 
echo "window._env_ = {" >> /usr/share/nginx/html/config.js

# Read environment variables and set them in config.js
echo "  VITE_DISCOGS_USERNAME: \"$VITE_DISCOGS_USERNAME\"," >> /usr/share/nginx/html/config.js

echo "}" >> /usr/share/nginx/html/config.js 