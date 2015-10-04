#!/bin/bash
set -e

# Set host-name and enable-dbus
sed -i "s@#host-name=foo@host-name=$(echo $RESIN_DEVICE_UUID | cut -c1-7)@" /etc/avahi/avahi-daemon.conf

# Restart service
/etc/init.d/avahi-daemon restart

npm start
