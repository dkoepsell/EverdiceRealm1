import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Scale, FileText, Shield } from "lucide-react";

export default function LegalPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-fantasy font-bold text-primary mb-2">Legal Information & Licenses</h1>
        <p className="text-muted-foreground">
          Important legal notices, attributions, and license information for Everdice
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Fan Content Policy Disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              Everdice is unofficial Fan Content permitted under the{" "}
              <a 
                href="https://company.wizards.com/en/legal/fancontentpolicy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Wizards of the Coast Fan Content Policy
                <ExternalLink className="h-3 w-3" />
              </a>.
            </p>
            <p className="text-sm leading-relaxed font-medium">
              Not approved/endorsed by Wizards of the Coast. Portions of the materials used are property 
              of Wizards of the Coast. ©Wizards of the Coast LLC.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This application is an unofficial fan project created for personal and educational purposes. 
              It is not affiliated with, endorsed by, or sponsored by Wizards of the Coast LLC or Hasbro, Inc.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              System Reference Document 5.1 (SRD 5.1)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by 
              Wizards of the Coast LLC and available at{" "}
              <a 
                href="https://dnd.wizards.com/resources/systems-reference-document" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                dnd.wizards.com/resources/systems-reference-document
                <ExternalLink className="h-3 w-3" />
              </a>.
            </p>
            <p className="text-sm leading-relaxed">
              The SRD 5.1 is licensed under the{" "}
              <a 
                href="https://creativecommons.org/licenses/by/4.0/legalcode" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Creative Commons Attribution 4.0 International License (CC BY 4.0)
                <ExternalLink className="h-3 w-3" />
              </a>.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">SRD Content Used</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Core game mechanics (ability scores, skills, combat rules)</li>
                <li>Character classes and their base features</li>
                <li>Races and their traits</li>
                <li>SRD-compatible spells and magic items</li>
                <li>SRD-compatible creatures and monsters</li>
                <li>Equipment and adventuring gear</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Trademark Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              "Dungeons & Dragons," "D&D," "Dungeon Master," and related terms are registered trademarks 
              of Wizards of the Coast LLC. All trademark rights remain with their respective owners.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The use of these terms in this application is for descriptive purposes only and does not 
              imply any affiliation with or endorsement by the trademark owners. Terms like "DM" and 
              "Dungeon Master" are used in their common tabletop RPG context as permitted under fair use.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Trademarks Not Used</h4>
              <p className="text-sm text-muted-foreground">
                This application avoids using proprietary campaign settings (Forgotten Realms, Eberron, etc.), 
                product-identity creatures not in the SRD (Beholder, Mind Flayer, etc.), and official 
                Wizards of the Coast logos or branding.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              CAML-5e License
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              This application implements the Canonical Adventure Markup Language (CAML-5e) specification 
              for adventure content import and export. CAML-5e is available at{" "}
              <a 
                href="https://github.com/dkoepsell/CAML5e" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                github.com/dkoepsell/CAML5e
                <ExternalLink className="h-3 w-3" />
              </a>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Third-Party Libraries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Everdice is built using open-source libraries and frameworks. Each library is used under 
              its respective license (MIT, Apache 2.0, etc.). Major dependencies include React, Express.js, 
              Drizzle ORM, and various UI component libraries.
            </p>
            <p className="text-sm text-muted-foreground">
              For a complete list of dependencies and their licenses, please refer to the package.json 
              file in the project repository.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>Last updated: January 2025</p>
          <p className="mt-2">
            Questions about licensing? Contact the project maintainer on{" "}
            <a 
              href="https://github.com/dkoepsell/Everdice" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
