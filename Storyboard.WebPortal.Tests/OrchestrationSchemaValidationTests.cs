using System.Text;
using System.Text.Json.Nodes;
using Json.Schema;

namespace Storyboard.WebPortal.Tests;

public sealed class OrchestrationSchemaValidationTests
{
    public static IEnumerable<object[]> OrchestrationSchemaPairs()
    {
        yield return new object[] { "experience-state-featuremap.v1.json", "experience-state-featuremap.v1.schema.json" };
        yield return new object[] { "experience-state-compositions.v1.json", "experience-state-compositions.v1.schema.json" };
        yield return new object[] { "skeleton-layouts.v1.json", "skeleton-layouts.v1.schema.json" };
        yield return new object[] { "form-factor-feature-implementations.v1.json", "form-factor-feature-implementations.v1.schema.json" };
        yield return new object[] { "feature-catalog.v1.json", "feature-catalog.v1.schema.json" };
        yield return new object[] { "ui-slots.v1.json", "ui-slots.v1.schema.json" };
        yield return new object[] { "diagnostics-policy.v1.json", "diagnostics-policy.v1.schema.json" };
        yield return new object[] { "theme-contract.v1.json", "theme-contract.v1.schema.json" };
    }

    [Theory]
    [MemberData(nameof(OrchestrationSchemaPairs))]
    public void OrchestrationConfig_MatchesDeclaredSchema(string configFileName, string schemaFileName)
    {
        var orchestrationDir = GetOrchestrationDirectory();
        var schemaDir = Path.Combine(orchestrationDir, "schemas");

        var configPath = Path.Combine(orchestrationDir, configFileName);
        var schemaPath = Path.Combine(schemaDir, schemaFileName);

        Assert.True(File.Exists(configPath), $"Config file not found: {configPath}");
        Assert.True(File.Exists(schemaPath), $"Schema file not found: {schemaPath}");

        var schemaText = File.ReadAllText(schemaPath);
        var configText = File.ReadAllText(configPath);

        var schema = JsonSchema.FromText(schemaText);
        var configNode = JsonNode.Parse(configText);
        Assert.NotNull(configNode);

        var result = schema.Evaluate(
            configNode!,
            new EvaluationOptions
            {
                OutputFormat = OutputFormat.Hierarchical
            });

        if (result.IsValid)
        {
            return;
        }

        var failureSummary = BuildFailureSummary(result);
        Assert.True(
            result.IsValid,
            $"Schema validation failed for '{configFileName}' against '{schemaFileName}'.{Environment.NewLine}{failureSummary}");
    }

    private static string GetOrchestrationDirectory()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var solutionPath = Path.Combine(current.FullName, "StoryboardDesigner.slnx");
            if (File.Exists(solutionPath))
            {
                var orchestration = Path.Combine(current.FullName, "Storyboard.WebPortal", "config", "orchestration");
                if (!Directory.Exists(orchestration))
                {
                    throw new DirectoryNotFoundException($"Orchestration directory not found: {orchestration}");
                }

                return orchestration;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate StoryboardDesigner.slnx from test base directory.");
    }

    private static string BuildFailureSummary(EvaluationResults results)
    {
        var buffer = new StringBuilder();
        AppendFailures(results, buffer, 0);
        return buffer.ToString();
    }

    private static void AppendFailures(EvaluationResults results, StringBuilder buffer, int depth)
    {
        if (!results.IsValid)
        {
            var indent = new string(' ', depth * 2);
            var path = string.IsNullOrWhiteSpace(results.InstanceLocation.ToString())
                ? "<root>"
                : results.InstanceLocation.ToString();

            var messages = results.Errors is null || results.Errors.Count == 0
                ? "validation failed"
                : string.Join(" | ", results.Errors.Select(e => e.Value));

            buffer.Append(indent)
                .Append(path)
                .Append(": ")
                .AppendLine(messages);
        }

        foreach (var child in results.Details)
        {
            AppendFailures(child, buffer, depth + 1);
        }
    }
}
