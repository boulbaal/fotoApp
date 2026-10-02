# remote-helper

A tiny copy-paste website for helping fix FotoApp on another computer in the
same home network, without SSH. Python standard library only.

- The helper machine runs `python3 server.py` (port 8790, or set `PORT`).
- The other computer opens `http://<helper-ip>:8790` in a browser, copies each
  command with the **Kopieer** button, runs it in a terminal and pastes the
  output back with **Verstuur**.
- Steps come from `commands.json` (see `commands.example.json`); the page
  reloads itself when that file changes.
- Pasted output is saved in `inbox/` as text files. Files placed in `files/`
  can be downloaded at `/files/<name>`.

Security: there is no authentication. Only run it on a trusted home network,
allow the port for your local subnet only in the firewall, and close it again
afterwards. Never paste passwords into it.
