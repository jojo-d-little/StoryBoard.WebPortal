using System.Text.Json;

namespace Storyboard.WebPortal.Tests;

public sealed class OrchestrationContractReferenceValidationTests
{
    [Fact]
    public void ExperienceStateFeatureMap_UsesKnownExperienceStatesAndFeatures()
    {
        using var featureMap = LoadJson("experience-state-featuremap.v1.json");

        var states = GetObjectProperty(featureMap.RootElement, "experienceStates");
        var stateNames = states.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);

        var initialState = featureMap.RootElement.GetProperty("initialExperienceState").GetString();
        Assert.False(string.IsNullOrWhiteSpace(initialState));
        Assert.Contains(initialState!, stateNames);
    }

    [Fact]
    public void ExperienceStateCompositions_ReferenceKnownStatesSlotsModesAndFeatures()
    {
        using var compositions = LoadJson("experience-state-compositions.v1.json");
        using var featureMap = LoadJson("experience-state-featuremap.v1.json");
        using var featureCatalog = LoadJson("feature-catalog.v1.json");
        using var slots = LoadJson("ui-slots.v1.json");

        var knownStates = GetObjectProperty(featureMap.RootElement, "experienceStates")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        var knownFeatures = GetObjectProperty(featureCatalog.RootElement, "features")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        var knownSlots = GetObjectProperty(slots.RootElement, "slots")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        var allowedModes = GetArrayProperty(slots.RootElement, "allowedSlotModes")
            .EnumerateArray()
            .Select(x => x.GetString()!)
            .ToHashSet(StringComparer.Ordinal);

        var defaultCompositionProfileKey = GetObjectProperty(featureMap.RootElement, "resolutionDefaults")
            .GetProperty("defaultCompositionProfileKey")
            .GetString();
        Assert.False(string.IsNullOrWhiteSpace(defaultCompositionProfileKey));

        var stateProfiles = GetObjectProperty(compositions.RootElement, "stateProfiles");
        foreach (var stateProfile in stateProfiles.EnumerateObject())
        {
            Assert.Contains(stateProfile.Name, knownStates);

            var profiles = GetObjectProperty(stateProfile.Value, "profiles");
            var profileKeys = profiles.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);
            Assert.NotEmpty(profileKeys);

            var defaultProfileKey = stateProfile.Value.TryGetProperty("defaultProfile", out var defaultProfileProp)
                ? defaultProfileProp.GetString()
                : defaultCompositionProfileKey;
            Assert.False(string.IsNullOrWhiteSpace(defaultProfileKey));
            Assert.Contains(defaultProfileKey!, profileKeys);

            foreach (var profile in profiles.EnumerateObject())
            {
                var assignments = GetArrayProperty(profile.Value, "slotAssignments");
                foreach (var assignment in assignments.EnumerateArray())
                {
                    var slotKey = assignment.GetProperty("slotKey").GetString();
                    Assert.False(string.IsNullOrWhiteSpace(slotKey));
                    Assert.Contains(slotKey!, knownSlots);

                    var mode = assignment.GetProperty("mode").GetString();
                    Assert.False(string.IsNullOrWhiteSpace(mode));
                    Assert.Contains(mode!, allowedModes);

                    if (assignment.TryGetProperty("featureKey", out var featureKeyProp))
                    {
                        var featureKey = featureKeyProp.GetString();
                        Assert.False(string.IsNullOrWhiteSpace(featureKey));
                        Assert.Contains(featureKey!, knownFeatures);
                    }
                }
            }
        }
    }

    [Fact]
    public void SkeletonLayouts_ReferenceKnownSlotsOnly()
    {
        using var skeletonLayouts = LoadJson("skeleton-layouts.v1.json");
        using var slots = LoadJson("ui-slots.v1.json");

        var knownSlots = GetObjectProperty(slots.RootElement, "slots")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        var layouts = GetObjectProperty(skeletonLayouts.RootElement, "skeletonLayouts");
        foreach (var layout in layouts.EnumerateObject())
        {
            var family = layout.Value.GetProperty("family").GetString();
            Assert.False(string.IsNullOrWhiteSpace(family));

            var formFactorKey = layout.Value.GetProperty("formFactorKey").GetString();
            Assert.False(string.IsNullOrWhiteSpace(formFactorKey));

            var templatePath = layout.Value.GetProperty("templatePath").GetString();
            Assert.False(string.IsNullOrWhiteSpace(templatePath));

            if (layout.Value.TryGetProperty("templateSlots", out var templateSlots))
            {
                Assert.Equal(JsonValueKind.Array, templateSlots.ValueKind);
                foreach (var slotKey in templateSlots.EnumerateArray().Select(x => x.GetString()))
                {
                    Assert.False(string.IsNullOrWhiteSpace(slotKey));
                    Assert.Contains(slotKey!, knownSlots);
                }
            }
        }
    }

    [Fact]
    public void FormFactorFeatureImplementations_ReferenceKnownFeaturesAndCoverCatalog()
    {
        using var implementations = LoadJson("form-factor-feature-implementations.v1.json");
        using var featureCatalog = LoadJson("feature-catalog.v1.json");

        var knownFeatures = GetObjectProperty(featureCatalog.RootElement, "features")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        var formFactors = GetObjectProperty(implementations.RootElement, "formFactors");
        var formFactorKeys = formFactors.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);

        var defaultFormFactor = implementations.RootElement.GetProperty("defaultFormFactorKey").GetString();
        Assert.False(string.IsNullOrWhiteSpace(defaultFormFactor));
        Assert.Contains(defaultFormFactor!, formFactorKeys);

        foreach (var formFactor in formFactors.EnumerateObject())
        {
            var map = GetObjectProperty(formFactor.Value, "implementationByFeature");
            var mappedFeatures = map.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);

            foreach (var mappedFeature in mappedFeatures)
            {
                Assert.Contains(mappedFeature, knownFeatures);
            }

            foreach (var knownFeature in knownFeatures)
            {
                Assert.Contains(knownFeature, mappedFeatures);
            }

            foreach (var pair in map.EnumerateObject())
            {
                if (pair.Value.ValueKind == JsonValueKind.String)
                {
                    var implementationKey = pair.Value.GetString();
                    Assert.False(string.IsNullOrWhiteSpace(implementationKey));
                    continue;
                }

                Assert.Equal(JsonValueKind.Object, pair.Value.ValueKind);
                var implementation = pair.Value;
                var implementationKeyFromObject = implementation.GetProperty("implementationKey").GetString();
                Assert.False(string.IsNullOrWhiteSpace(implementationKeyFromObject));

                var orientation = implementation.GetProperty("orientation").GetString();
                Assert.True(string.Equals(orientation, "horizontal", StringComparison.Ordinal)
                    || string.Equals(orientation, "vertical", StringComparison.Ordinal));

                var density = implementation.GetProperty("density").GetString();
                Assert.True(string.Equals(density, "regular", StringComparison.Ordinal)
                    || string.Equals(density, "compact", StringComparison.Ordinal));
            }
        }
    }

    [Fact]
    public void ResolutionDefaults_ReferenceKnownSkeletonLayoutAndCompositionProfileModel()
    {
        using var featureMap = LoadJson("experience-state-featuremap.v1.json");
        using var skeletonLayouts = LoadJson("skeleton-layouts.v1.json");
        using var compositions = LoadJson("experience-state-compositions.v1.json");
        using var implementations = LoadJson("form-factor-feature-implementations.v1.json");

        var knownSkeletonLayouts = GetObjectProperty(skeletonLayouts.RootElement, "skeletonLayouts")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        var knownFormFactors = GetObjectProperty(implementations.RootElement, "formFactors")
            .EnumerateObject()
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        var compositionProfiles = GetObjectProperty(compositions.RootElement, "stateProfiles")
            .EnumerateObject()
            .SelectMany(state => GetObjectProperty(state.Value, "profiles").EnumerateObject().Select(profile => profile.Name))
            .ToHashSet(StringComparer.Ordinal);

        var defaults = GetObjectProperty(featureMap.RootElement, "resolutionDefaults");

        var skeletonKey = defaults.GetProperty("defaultSkeletonLayoutKey").GetString();
        Assert.False(string.IsNullOrWhiteSpace(skeletonKey));
        Assert.Contains(skeletonKey!, knownSkeletonLayouts);

        var formFactorKey = defaults.GetProperty("defaultFormFactorKey").GetString();
        Assert.False(string.IsNullOrWhiteSpace(formFactorKey));
        Assert.Contains(formFactorKey!, knownFormFactors);

        var compositionProfileKey = defaults.GetProperty("defaultCompositionProfileKey").GetString();
        Assert.False(string.IsNullOrWhiteSpace(compositionProfileKey));
        Assert.Contains(compositionProfileKey!, compositionProfiles);
    }

    private static JsonDocument LoadJson(string fileName)
    {
        var path = Path.Combine(GetOrchestrationDirectory(), fileName);
        var json = File.ReadAllText(path);
        return JsonDocument.Parse(json);
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

    private static JsonElement GetObjectProperty(JsonElement element, string propertyName)
    {
        var property = element.GetProperty(propertyName);
        Assert.Equal(JsonValueKind.Object, property.ValueKind);
        return property;
    }

    private static JsonElement GetArrayProperty(JsonElement element, string propertyName)
    {
        var property = element.GetProperty(propertyName);
        Assert.Equal(JsonValueKind.Array, property.ValueKind);
        return property;
    }
}
