#!/usr/bin/env python
import urllib2
import re
import sys

url = "http://pheed.upi.com/news/sports_news_rss"

conn = urllib2.urlopen(url)
data = conn.read()

argv = None
if sys.argv[1] == 'COL':
    argv = 'COL\sFB'
else:
    argv = sys.argv[1]

pat = re.compile(r'<title>' + argv + r':\s*(.*)<')

match = False
for line in data.split('\n'):
    result = pat.search(line)
    if result:
        match = True
        print result.group(1)

if not match:
    print "No active feed found for %s!" % argv        
