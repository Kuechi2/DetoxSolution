using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()     // Erlaubt ALLE Webseiten
              .AllowAnyMethod()     // Erlaubt ALLE HTTP-Methoden
              .AllowAnyHeader()     // Erlaubt ALLE Header
              .SetIsOriginAllowed(origin => true); // Sicherheits-Override
    });
});

var app = builder.Build();
app.UseCors("AllowAll");
// CORS erlauben
app.UseCors(policy => policy
    .AllowAnyOrigin()
    .AllowAnyMethod()
    .AllowAnyHeader());

// Deine Regel-Engine
var detoxRules = new Dictionary<string, string>
{
    { "dumm", "nicht durchdacht" },
    { "idiot", "unpassend handelnd" },
    { "scheiße", "problematisch" },
    { "hass", "starke Ablehnung" },
    { "blöd", "unvorteilhaft" },
    { "nazi", "nationalistisch" },
    { "drecks", "" }, // Leer = entfernen
    { "arschloch", "unsachlich" }
};

// Einfache Endpoint für MVP
app.MapPost("/api/detoxify", (DetoxRequest request) =>
{
    var text = request.Text;
    var toxicityScore = 0;
    var appliedRules = new List<string>();
    
    foreach (var rule in detoxRules)
    {
        if (text.Contains(rule.Key, StringComparison.OrdinalIgnoreCase))
        {
            // Zähle wie oft ersetzt wurde
            var count = Regex.Matches(text, rule.Key, RegexOptions.IgnoreCase).Count;
            toxicityScore += count;
            
            // Ersetze das Wort
            text = Regex.Replace(text, rule.Key, rule.Value, RegexOptions.IgnoreCase);
            appliedRules.Add(rule.Key);
        }
    }
    
    // Einfache Kontext-Erkennung
    string contextAnalysis = "Allgemeiner Kommentar";
    if (text.Contains("flüchtling", StringComparison.OrdinalIgnoreCase) || 
        text.Contains("migrant", StringComparison.OrdinalIgnoreCase))
    {
        contextAnalysis = "Thema: Migration/Integration";
    }
    else if (text.Contains("schule", StringComparison.OrdinalIgnoreCase) ||
             text.Contains("bildung", StringComparison.OrdinalIgnoreCase))
    {
        contextAnalysis = "Thema: Bildung";
    }
    
    return new
    {
        original = request.Text,
        detoxified = text.Trim(),
        toxicityScore,
        appliedRules,
        context = contextAnalysis,
        hasToxicity = toxicityScore > 0,
        timestamp = DateTime.Now.ToString("HH:mm:ss")
    };
});
app.MapPost("/api/analyze-context", (ContextAnalysisRequest request) =>
{
    // Einfache Kontext-Erkennung
    string detectedTopic = "Allgemein";
    string constructiveSuggestion = "Bitte formulieren Sie sachlicher.";

    // Alle vorherigen Nachrichten als Text
    var allMessages = string.Join(" ", request.PreviousMessages);

    // Themen-Erkennung
    if (allMessages.Contains("Flüchtling", StringComparison.OrdinalIgnoreCase) ||
        allMessages.Contains("Migrant", StringComparison.OrdinalIgnoreCase) ||
        allMessages.Contains("Asyl", StringComparison.OrdinalIgnoreCase))
    {
        detectedTopic = "Migration";

        if (request.LastMessage.Contains("Nazi", StringComparison.OrdinalIgnoreCase) ||
            request.LastMessage.Contains("Drecks", StringComparison.OrdinalIgnoreCase))
        {
            constructiveSuggestion = "Statt persönlicher Angriffe könnten Sie konkret benennen, " +
                                   "welche Aspekte der Migrationspolitik Sie kritisieren.";
        }
    }
    else if (allMessages.Contains("Schule", StringComparison.OrdinalIgnoreCase) ||
             allMessages.Contains("Bildung", StringComparison.OrdinalIgnoreCase))
    {
        detectedTopic = "Bildung";
        constructiveSuggestion = "Konkretisieren Sie bitte, was genau verbessert werden sollte.";
    }

    // Toxizität berechnen
    var toxicWords = new[] { "idiot", "dumm", "scheiße", "nazi", "arsch", "hure" };
    var toxicityScore = toxicWords.Count(word =>
        request.LastMessage.Contains(word, StringComparison.OrdinalIgnoreCase));

    return new
    {
        original = request.LastMessage,
        topic = detectedTopic,
        suggestion = constructiveSuggestion,
        toxicityScore = toxicityScore,
        isConstructive = toxicityScore == 0,
        messageCount = request.PreviousMessages.Length + 1,
        analysis = $"Erkanntes Thema: {detectedTopic}"
    };
});

// Health Check
app.MapGet("/", () => "De-Tox Backend läuft! 🚀");

app.Run();

// Daten-Klassen
public record DetoxRequest(string Text);
public record ContextRequest(List<string> Messages);
public record ContextAnalysisRequest(string LastMessage, string[] PreviousMessages);