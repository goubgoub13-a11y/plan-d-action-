using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;
using System.Linq;
// Usage : Valid fichier.xlsx — valide le classeur contre les schémas Office (extensions Microsoft 365 comprises)
int total = 0;
foreach (var path in args) {
  using var doc = SpreadsheetDocument.Open(path, false);
  var v = new OpenXmlValidator(FileFormatVersions.Microsoft365);
  var errs = v.Validate(doc).ToList();
  total += errs.Count;
  System.Console.WriteLine($"{path}: {errs.Count} erreur(s)");
  foreach (var e in errs.Take(60))
    System.Console.WriteLine($"  [{e.ErrorType}] {e.Part?.Uri} {e.Path?.XPath} :: {e.Description}");
}
return total == 0 ? 0 : 1;
