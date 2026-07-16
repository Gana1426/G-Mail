# Rspamd local configuration
enabled = true;
bind_socket = "0.0.0.0:11332";
controller_bind_socket = "0.0.0.0:11334";

# Antivirus integration
antivirus {
  type = "clamav";
  servers = "clamav:3310";
  action = "reject";
  message = 'ClamAV: virus found: "${VIRUS}"';
  scan_mime_parts = true;
  scan_text_mime = true;
  scan_image_mime = true;
  scan_pdf_mime = true;
  max_size = 25000000;
}

# DKIM signing
dkim_signing {
  sign_local = true;
  sign_authenticated = true;
  use_domain = "header";
  use_esld = true;
  allow_username_mismatch = false;
}

# DMARC
dmarc {
  symbols_prefix = "DMARC_";
}

# Actions
actions {
  reject = 15;
  add_header = 6;
  greylist = 4;
}
