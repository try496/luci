'use strict';
'require form';
'require fs';
'require uci';
'require view';

return view.extend({
	render: function (stats) {
		var m, s, o;

		m = new form.Map("acme", _("ACME certificates"),
			_("This configures ACME (Letsencrypt) automatic certificate installation. " +
				"Simply fill out this to have the router configured with Letsencrypt-issued " +
				"certificates for the web interface. " +
				"Note that the domain names in the certificate must already be configured to " +
				"point at the router's public IP address. " +
				"Once configured, issuing certificates can take a while. " +
				"Check the logs for progress and any errors.") + '<br/>' +
				_("Cert files are stored in") + ' <em>/etc/ssl/acme<em>'
		);

		s = m.section(form.TypedSection, "acme", _("ACME global config"));
		s.anonymous = true;

		o = s.option(form.Value, "account_email", _("Account email"),
			_("Email address to associate with account key."))
		o.rmempty = false;
		o.datatype = "minlength(1)";

		o = s.option(form.Flag, "debug", _("Enable debug logging"));
		o.rmempty = false;

		s = m.section(form.GridSection, "cert", _("Certificate config"))
		s.anonymous = false;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.tab("general", _("General Settings"));
		o = s.tab('challenge_webroot', _('Webroot Challenge Validation'));
		o = s.tab('challenge_dns', _('DNS Challenge Validation'));
		o = s.tab("advanced", _('Advanced Settings'));

		o = s.taboption('general', form.Flag, "enabled", _("Enabled"));
		o.rmempty = false;

		o = s.taboption('general', form.DynamicList, "domains", _("Domain names"),
			_("Domain names to include in the certificate. " +
				"The first name will be the subject name, subsequent names will be alt names. " +
				"Note that all domain names must point at the router in the global DNS."));
		o.datatype = "list(string)";

		o = s.taboption('general', form.ListValue, 'validation_method', _('Validation method'),
			_("Standalone mode will use the built-in webserver of acme.sh to issue a certificate. " +
			"Webroot mode will use an existing webserver to issue a certificate. " +
			"DNS mode will allow you to use the DNS API of your DNS provider to issue a certificate."));
		o.value("standalone", _("Standalone"));
		o.value("webroot", _("Webroot"));
		o.value("dns", _("DNS"));
		o.default = 'webroot';

		o = s.taboption('challenge_webroot', form.Value, 'webroot', _('Webroot directory'),
			_("Webserver root directory. Set this to the webserver " +
				"document root to run Acme in webroot mode. The web " +
				"server must be accessible from the internet on port 80.") + '<br/>' +
			_("Default") + " <em>/var/run/acme/challenge/</em>"
		);
		o.optional = true;
		o.depends("validation_method", "webroot");
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.Value, 'dns', _('DNS API'),
			_("To use DNS mode to issue certificates, set this to the name of a DNS API supported by acme.sh. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/dnsapi for the list of available APIs. " +
				"In DNS mode, the domain name does not have to resolve to the router IP. " +
				"DNS mode is also the only mode that supports wildcard certificates. " +
				"Using this mode requires the acme-dnsapi package to be installed."));
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.DynamicList, 'credentials', _('DNS API credentials'),
			_("The credentials for the DNS API mode selected above. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/dnsapi for the format of credentials required by each API. " +
				"Add multiple entries here in KEY=VAL shell variable format to supply multiple credential variables."))
		o.datatype = "list(string)";
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.Value, 'calias', _('Challenge Alias'),
			_("The challenge alias to use for ALL domains. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/DNS-alias-mode for the details of this process. " +
				"LUCI only supports one challenge alias per certificate."));
		o.depends("validation_method", "dns");
		o.modalonly = true;

		o = s.taboption('challenge_dns', form.Value, 'dalias', _('Domain Alias'),
			_("The domain alias to use for ALL domains. " +
				"See https://github.com/acmesh-official/acme.sh/wiki/DNS-alias-mode for the details of this process. " +
				"LUCI only supports one challenge domain per certificate."));
		o.depends("validation_method", "dns");
		o.modalonly = true;


		o = s.taboption('advanced', form.Flag, 'use_staging', _('Use staging server'),
			_(
				'Get certificate from the Letsencrypt staging server ' +
				'(use for testing; the certificate won\'t be valid).'
			)
		);
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'key_type', _('Key size'),
			_('Key size (and type) for the generated certificate.')
		);
		o.value('rsa2048', _('RSA 2048 bits'));
		o.value('rsa3072', _('RSA 3072 bits'));
		o.value('rsa4096', _('RSA 4096 bits'));
		o.value('ec256', _('ECC 256 bits'));
		o.value('ec384', _('ECC 384 bits'));
		o.rmempty = false;
		o.optional = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id, set_value) {
			var keylength = uci.get('acme', section_id, 'keylength');
			if (keylength) {
				// migrate the old keylength to a new keytype
				switch (keylength) {
					case '2048': return 'rsa2048';
					case '3072': return 'rsa3072';
					case '4096': return 'rsa4096';
					case 'ec-256': return 'ec256';
					case 'ec-384': return 'ec384';
					default: return ''; // bad value
				}
			}
			return set_value;
		};
		o.write = function(section_id, value) {
			// remove old keylength
			uci.unset('acme', section_id, 'keylength');
			uci.set('acme', section_id, 'key_type', value);
		};

		o = s.taboption('advanced', form.Flag, "use_acme_server",
			_("Custom ACME CA"), _("Use a custom CA instead of Let's Encrypt."));
		o.depends("use_staging", "0");
		o.default = false;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, "acme_server", _("ACME server URL"),
			_("Custom ACME server directory URL."));
		o.depends("use_acme_server", "1");
		o.placeholder = "https://api.buypass.com/acme/directory";
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'days', _('Days until renewal'));
		o.optional    = true;
		o.placeholder = 90;
		o.datatype    = 'uinteger';
		o.modalonly = true;

		return m.render()
	}
})

