package irc

// ServerTemplate represents a pre-configured server template
type ServerTemplate struct {
	Name        string `json:"name"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	SSL         bool   `json:"ssl"`
	Description string `json:"description"`
}

// GetServerTemplates returns a list of popular IRC server presets
func GetServerTemplates() []ServerTemplate {
	return []ServerTemplate{
		{
			Name:        "Libera.Chat",
			Host:        "irc.libera.chat",
			Port:        6697,
			SSL:         true,
			Description: "Free and open source software community",
		},
		{
			Name:        "OFTC",
			Host:        "irc.oftc.net",
			Port:        6697,
			SSL:         true,
			Description: "Open and Free Technology Community",
		},
		{
			Name:        "Rizon",
			Host:        "irc.rizon.net",
			Port:        6697,
			SSL:         true,
			Description: "General purpose IRC network",
		},
		{
			Name:        "EFnet",
			Host:        "irc.efnet.org",
			Port:        6697,
			SSL:         true,
			Description: "The original IRC network",
		},
		{
			Name:        "Undernet",
			Host:        "irc.undernet.org",
			Port:        6697,
			SSL:         true,
			Description: "International IRC network",
		},
		{
			Name:        "DALnet",
			Host:        "irc.dal.net",
			Port:        6697,
			SSL:         true,
			Description: "One of the oldest IRC networks",
		},
		{
			Name:        "QuakeNet",
			Host:        "irc.quakenet.org",
			Port:        6697,
			SSL:         true,
			Description: "Gaming and esports community",
		},
		{
			Name:        "IRCnet",
			Host:        "open.ircnet.net",
			Port:        6667,
			SSL:         false,
			Description: "One of the oldest IRC networks",
		},
	}
}
