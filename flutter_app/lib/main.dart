import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const AstroPlannerApp());
}

class AstroPlannerApp extends StatelessWidget {
  const AstroPlannerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Astro Planner Mobile',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      home: const SetupPage(),
    );
  }
}

class SetupParams {
  SetupParams({
    required this.baseUrl,
    required this.lat,
    required this.lon,
    required this.sensorW,
    required this.sensorH,
    required this.pixelUm,
    required this.focalMm,
    required this.fNum,
    required this.mount,
    required this.date,
    required this.minAlt,
    required this.maxMag,
    required this.bortle,
    required this.minScore,
    required this.targetId,
  });

  final String baseUrl;
  final double lat;
  final double lon;
  final double sensorW;
  final double sensorH;
  final double pixelUm;
  final double focalMm;
  final double fNum;
  final String mount;
  final DateTime date;
  final double minAlt;
  final double maxMag;
  final double bortle;
  final double minScore;
  final String targetId;

  Map<String, String> toQuery({int limit = 500}) => {
        'lat': lat.toString(),
        'lon': lon.toString(),
        'sensorW': sensorW.toString(),
        'sensorH': sensorH.toString(),
        'pixelUm': pixelUm.toString(),
        'focalMm': focalMm.toString(),
        'fNum': fNum.toString(),
        'mount': mount,
        'date': date.toUtc().toIso8601String(),
        'minAlt': minAlt.toString(),
        'maxMag': maxMag.toString(),
        'bortle': bortle.toString(),
        'minScore': minScore.toString(),
        'limit': limit.toString(),
        if (targetId.trim().isNotEmpty) 'targetId': targetId.trim(),
      };
}

class CameraSuggestion {
  CameraSuggestion({
    required this.id,
    required this.name,
    required this.sensorW,
    required this.sensorH,
    required this.pixelUm,
  });

  final String id;
  final String name;
  final double sensorW;
  final double sensorH;
  final double? pixelUm;

  factory CameraSuggestion.fromJson(Map<String, dynamic> json) => CameraSuggestion(
        id: (json['id'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        sensorW: (json['sensorW'] as num).toDouble(),
        sensorH: (json['sensorH'] as num).toDouble(),
        pixelUm: (json['pixelUm'] as num?)?.toDouble(),
      );
}

class Recommendation {
  Recommendation({
    required this.id,
    required this.name,
    required this.type,
    required this.fillRatio,
    required this.framingScore,
    required this.score,
    required this.visibilityScore,
    required this.visibleHours,
    required this.scoreBreakdown,
    required this.moon,
    required this.weather,
    required this.suggestedCapture,
    required this.window,
  });

  final String id;
  final String name;
  final String type;
  final double fillRatio;
  final double framingScore;
  final double score;
  final double visibilityScore;
  final double visibleHours;
  final ScoreBreakdown? scoreBreakdown;
  final MoonDiagnostics? moon;
  final WeatherDiagnostics? weather;
  final SuggestedCapture suggestedCapture;
  final VisibilityWindow? window;

  factory Recommendation.fromJson(Map<String, dynamic> json) => Recommendation(
        id: (json['id'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        type: (json['type'] ?? '').toString(),
        fillRatio: (json['fill_ratio'] as num?)?.toDouble() ?? 0,
        framingScore: (json['framing_score'] as num?)?.toDouble() ?? 0,
        score: (json['score'] as num?)?.toDouble() ?? 0,
        visibilityScore: (json['visibility_score'] as num?)?.toDouble() ?? 0,
        visibleHours: (json['visible_hours'] as num?)?.toDouble() ?? 0,
        scoreBreakdown: json['score_breakdown'] is Map<String, dynamic>
            ? ScoreBreakdown.fromJson(json['score_breakdown'] as Map<String, dynamic>)
            : null,
        moon: json['moon'] is Map<String, dynamic>
            ? MoonDiagnostics.fromJson(json['moon'] as Map<String, dynamic>)
            : null,
        weather: json['weather'] is Map<String, dynamic>
            ? WeatherDiagnostics.fromJson(json['weather'] as Map<String, dynamic>)
            : null,
        suggestedCapture: SuggestedCapture.fromJson(
          (json['suggested_capture'] as Map<String, dynamic>? ?? {}),
        ),
        window: json['window'] is Map<String, dynamic>
            ? VisibilityWindow.fromJson(json['window'] as Map<String, dynamic>)
            : null,
      );
}

class SuggestedCapture {
  SuggestedCapture({
    required this.subExposureS,
    required this.gain,
    required this.subs,
    required this.notes,
  });

  final int subExposureS;
  final int gain;
  final int subs;
  final String notes;

  factory SuggestedCapture.fromJson(Map<String, dynamic> json) => SuggestedCapture(
        subExposureS: (json['sub_exposure_s'] as num?)?.toInt() ?? 0,
        gain: (json['gain'] as num?)?.toInt() ?? 0,
        subs: (json['subs'] as num?)?.toInt() ?? 0,
        notes: (json['notes'] ?? '').toString(),
      );
}

class VisibilityWindow {
  VisibilityWindow({
    required this.startUtc,
    required this.endUtc,
    required this.altMaxDeg,
  });

  final DateTime startUtc;
  final DateTime endUtc;
  final double altMaxDeg;

  factory VisibilityWindow.fromJson(Map<String, dynamic> json) => VisibilityWindow(
        startUtc: DateTime.parse((json['start_utc'] ?? '').toString()).toLocal(),
        endUtc: DateTime.parse((json['end_utc'] ?? '').toString()).toLocal(),
        altMaxDeg: (json['alt_max_deg'] as num?)?.toDouble() ?? 0,
      );
}

class ScoreBreakdown {
  ScoreBreakdown({
    required this.visibility,
    required this.framing,
    required this.season,
    required this.moon,
    required this.weather,
    required this.skyQuality,
  });

  final double visibility;
  final double framing;
  final double season;
  final double moon;
  final double weather;
  final double skyQuality;

  factory ScoreBreakdown.fromJson(Map<String, dynamic> json) => ScoreBreakdown(
        visibility: (json['visibility'] as num?)?.toDouble() ?? 0,
        framing: (json['framing'] as num?)?.toDouble() ?? 0,
        season: (json['season'] as num?)?.toDouble() ?? 0,
        moon: (json['moon'] as num?)?.toDouble() ?? 0,
        weather: (json['weather'] as num?)?.toDouble() ?? 0,
        skyQuality: (json['sky_quality'] as num?)?.toDouble() ?? 0,
      );
}

class MoonDiagnostics {
  MoonDiagnostics({
    required this.illuminationFraction,
    required this.averageAltitudeDeg,
    required this.averageSeparationDeg,
    required this.aboveHorizonFraction,
  });

  final double illuminationFraction;
  final double? averageAltitudeDeg;
  final double? averageSeparationDeg;
  final double aboveHorizonFraction;

  factory MoonDiagnostics.fromJson(Map<String, dynamic> json) => MoonDiagnostics(
        illuminationFraction: (json['illumination_fraction'] as num?)?.toDouble() ?? 0,
        averageAltitudeDeg: (json['average_altitude_deg'] as num?)?.toDouble(),
        averageSeparationDeg: (json['average_separation_deg'] as num?)?.toDouble(),
        aboveHorizonFraction: (json['above_horizon_fraction'] as num?)?.toDouble() ?? 0,
      );
}

class WeatherDiagnostics {
  WeatherDiagnostics({
    required this.avgCloudPct,
    required this.confidence,
    required this.sampleHours,
  });

  final double? avgCloudPct;
  final String confidence;
  final int sampleHours;

  factory WeatherDiagnostics.fromJson(Map<String, dynamic> json) => WeatherDiagnostics(
        avgCloudPct: (json['avg_cloud_pct'] as num?)?.toDouble(),
        confidence: (json['confidence'] ?? 'low').toString(),
        sampleHours: (json['sample_hours'] as num?)?.toInt() ?? 0,
      );
}

class RecommendResponse {
  RecommendResponse({
    required this.recommendedTargets,
    required this.contractVersion,
    required this.weatherSource,
    required this.weatherGeneratedAtUtc,
  });

  final List<Recommendation> recommendedTargets;
  final String? contractVersion;
  final String? weatherSource;
  final String? weatherGeneratedAtUtc;

  factory RecommendResponse.fromJson(Map<String, dynamic> json) {
    final list = (json['recommended_targets'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(Recommendation.fromJson)
        .toList();
    return RecommendResponse(
      recommendedTargets: list,
      contractVersion: (json['contract'] as Map<String, dynamic>?)?['version']?.toString(),
      weatherSource: (json['context'] as Map<String, dynamic>?)?['weather_source']?.toString(),
      weatherGeneratedAtUtc: (json['context'] as Map<String, dynamic>?)?['weather_generated_at_utc']?.toString(),
    );
  }
}

class PlannerItem {
  PlannerItem({
    required this.id,
    required this.name,
    required this.type,
    required this.score,
    required this.scoreBreakdown,
    required this.window,
    required this.moon,
    required this.weather,
  });

  final String id;
  final String name;
  final String type;
  final double score;
  final ScoreBreakdown? scoreBreakdown;
  final VisibilityWindow? window;
  final MoonDiagnostics? moon;
  final WeatherDiagnostics? weather;

  factory PlannerItem.fromJson(Map<String, dynamic> json) => PlannerItem(
        id: (json['id'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        type: (json['type'] ?? '').toString(),
        score: (json['score'] as num?)?.toDouble() ?? 0,
        scoreBreakdown: json['score_breakdown'] is Map<String, dynamic>
            ? ScoreBreakdown.fromJson(json['score_breakdown'] as Map<String, dynamic>)
            : null,
        window: json['window'] is Map<String, dynamic>
            ? VisibilityWindow.fromJson(json['window'] as Map<String, dynamic>)
            : null,
        moon: json['moon'] is Map<String, dynamic>
            ? MoonDiagnostics.fromJson(json['moon'] as Map<String, dynamic>)
            : null,
        weather: json['weather'] is Map<String, dynamic>
            ? WeatherDiagnostics.fromJson(json['weather'] as Map<String, dynamic>)
            : null,
      );
}

class PlannerNight {
  PlannerNight({required this.dateUtc, required this.bestWindows});

  final DateTime dateUtc;
  final List<PlannerItem> bestWindows;

  factory PlannerNight.fromJson(Map<String, dynamic> json) => PlannerNight(
        dateUtc: DateTime.parse((json['date_utc'] ?? '').toString()).toLocal(),
        bestWindows: (json['best_windows'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(PlannerItem.fromJson)
            .toList(),
      );
}

class PlannerResponse {
  PlannerResponse({
    required this.nights,
    required this.contractVersion,
    required this.weatherSource,
    required this.weatherGeneratedAtUtc,
  });

  final List<PlannerNight> nights;
  final String? contractVersion;
  final String? weatherSource;
  final String? weatherGeneratedAtUtc;

  factory PlannerResponse.fromJson(Map<String, dynamic> json) => PlannerResponse(
        nights: (json['nights'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(PlannerNight.fromJson)
            .toList(),
        contractVersion: (json['contract'] as Map<String, dynamic>?)?['version']?.toString(),
        weatherSource: (json['context'] as Map<String, dynamic>?)?['weather_source']?.toString(),
        weatherGeneratedAtUtc: (json['context'] as Map<String, dynamic>?)?['weather_generated_at_utc']?.toString(),
      );
}

class AstroApi {
  AstroApi(this.baseUrl);

  final String baseUrl;

  Uri _uri(String path, [Map<String, String>? query]) {
    final root = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    return Uri.parse('$root$path').replace(queryParameters: query);
  }

  Future<http.Response> _getWithRetry(Uri uri, {int retries = 2}) async {
    Object? lastError;
    for (var attempt = 0; attempt <= retries; attempt++) {
      try {
        final resp = await http.get(uri);
        if (resp.statusCode >= 500 && attempt < retries) {
          await Future<void>.delayed(Duration(milliseconds: 200 * (attempt + 1)));
          continue;
        }
        return resp;
      } catch (e) {
        lastError = e;
        if (attempt < retries) {
          await Future<void>.delayed(Duration(milliseconds: 200 * (attempt + 1)));
          continue;
        }
      }
    }
    throw Exception('Request failed: $lastError');
  }

  Future<List<CameraSuggestion>> searchCameras(String query) async {
    final uri = _uri('/api/camera', {'query': query});
    final resp = await _getWithRetry(uri);
    if (resp.statusCode != 200) {
      throw Exception('Camera search failed (${resp.statusCode}): ${resp.body}');
    }
    final json = jsonDecode(resp.body) as Map<String, dynamic>;
    final items = (json['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(CameraSuggestion.fromJson)
        .toList();
    return items;
  }

  Future<RecommendResponse> getRecommendations(SetupParams params) async {
    final uri = _uri('/api/recommend', params.toQuery());
    final resp = await _getWithRetry(uri);
    if (resp.statusCode != 200) {
      throw Exception('Recommend failed (${resp.statusCode}): ${resp.body}');
    }
    return RecommendResponse.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
  }

  Future<String> getPlan(SetupParams params) async {
    if (params.targetId.trim().isEmpty) {
      throw Exception('Target ID is required for plan generation');
    }
    final uri = _uri('/api/plan', {
      'lat': params.lat.toString(),
      'lon': params.lon.toString(),
      'targetId': params.targetId.trim(),
      'date': params.date.toUtc().toIso8601String(),
    });
    final resp = await _getWithRetry(uri);
    if (resp.statusCode != 200) {
      throw Exception('Plan failed (${resp.statusCode}): ${resp.body}');
    }
    return const JsonEncoder.withIndent('  ')
        .convert(jsonDecode(resp.body) as Map<String, dynamic>);
  }

  Future<PlannerResponse> getPlanner(
    SetupParams params, {
    required String range,
    String typeFilter = '',
    required double minScore,
    required double minAlt,
    int maxPerNight = 5,
  }) async {
    final uri = _uri('/api/planner', {
      'lat': params.lat.toString(),
      'lon': params.lon.toString(),
      'sensorW': params.sensorW.toString(),
      'sensorH': params.sensorH.toString(),
      'focalMm': params.focalMm.toString(),
      'date': params.date.toUtc().toIso8601String(),
      'range': range,
      'minScore': minScore.toString(),
      'minAlt': minAlt.toString(),
      'maxPerNight': maxPerNight.toString(),
      if (typeFilter.trim().isNotEmpty) 'type': typeFilter.trim(),
    });
    final resp = await _getWithRetry(uri);
    if (resp.statusCode != 200) {
      throw Exception('Planner failed (${resp.statusCode}): ${resp.body}');
    }
    return PlannerResponse.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
  }

  String imageUrl(String targetName) => _uri('/api/image', {'name': targetName}).toString();
}

class SetupPage extends StatefulWidget {
  const SetupPage({super.key});

  @override
  State<SetupPage> createState() => _SetupPageState();
}

class _SetupPageState extends State<SetupPage> {
  final _formKey = GlobalKey<FormState>();
  final _baseUrl = TextEditingController(text: _defaultBaseUrl());
  final _lat = TextEditingController(text: '37.9838');
  final _lon = TextEditingController(text: '23.7275');
  final _sensorW = TextEditingController(text: '23.5');
  final _sensorH = TextEditingController(text: '15.6');
  final _pixelUm = TextEditingController(text: '3.76');
  final _focalMm = TextEditingController(text: '200');
  final _fNum = TextEditingController(text: '2.8');
  final _minAlt = TextEditingController(text: '10');
  final _maxMag = TextEditingController(text: '12');
  final _bortle = TextEditingController(text: '4');
  final _minScore = TextEditingController(text: '0.5');
  final _targetId = TextEditingController();
  final _cameraQuery = TextEditingController();

  DateTime _date = DateTime.now().toUtc();
  String _mount = 'tracker';
  bool _loadingCamera = false;
  List<CameraSuggestion> _cameraSuggestions = [];

  AstroApi get _api => AstroApi(_baseUrl.text.trim());

  static String _defaultBaseUrl() {
    const fromEnv = String.fromEnvironment('ASTRO_BASE_URL', defaultValue: '');
    if (fromEnv.trim().isNotEmpty) return fromEnv.trim();
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  @override
  void dispose() {
    _baseUrl.dispose();
    _lat.dispose();
    _lon.dispose();
    _sensorW.dispose();
    _sensorH.dispose();
    _pixelUm.dispose();
    _focalMm.dispose();
    _fNum.dispose();
    _minAlt.dispose();
    _maxMag.dispose();
    _bortle.dispose();
    _minScore.dispose();
    _targetId.dispose();
    _cameraQuery.dispose();
    super.dispose();
  }

  String? _requiredNum(String? value) {
    if (value == null || value.trim().isEmpty) return 'Required';
    if (double.tryParse(value.trim()) == null) return 'Number required';
    return null;
  }

  SetupParams _params() => SetupParams(
        baseUrl: _baseUrl.text.trim(),
        lat: double.parse(_lat.text.trim()),
        lon: double.parse(_lon.text.trim()),
        sensorW: double.parse(_sensorW.text.trim()),
        sensorH: double.parse(_sensorH.text.trim()),
        pixelUm: double.parse(_pixelUm.text.trim()),
        focalMm: double.parse(_focalMm.text.trim()),
        fNum: double.parse(_fNum.text.trim()),
        mount: _mount,
        date: _date,
        minAlt: double.parse(_minAlt.text.trim()),
        maxMag: double.parse(_maxMag.text.trim()),
        bortle: double.parse(_bortle.text.trim()),
        minScore: double.parse(_minScore.text.trim()),
        targetId: _targetId.text.trim(),
      );

  Future<void> _searchCameras() async {
    final q = _cameraQuery.text.trim();
    if (q.length < 2) {
      setState(() => _cameraSuggestions = []);
      return;
    }
    setState(() => _loadingCamera = true);
    try {
      final items = await _api.searchCameras(q);
      if (!mounted) return;
      setState(() => _cameraSuggestions = items);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _loadingCamera = false);
    }
  }

  Future<void> _pickDate() async {
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _date.toLocal(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_date.toLocal()),
    );
    if (pickedTime == null) return;

    setState(() {
      _date = DateTime.utc(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      );
    });
  }

  void _toRecommendations() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RecommendationsPage(
          api: _api,
          params: _params(),
        ),
      ),
    );
  }

  void _toPlanner() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PlannerPage(
          api: _api,
          params: _params(),
        ),
      ),
    );
  }

  Future<void> _getPlan() async {
    if (!_formKey.currentState!.validate()) return;
    try {
      final plan = await _api.getPlan(_params());
      if (!mounted) return;
      showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Plan API response'),
          content: SingleChildScrollView(child: SelectableText(plan)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Astro Planner Setup')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _baseUrl,
              decoration: const InputDecoration(
                labelText: 'Backend Base URL',
                helperText: 'Android emulator: http://10.0.2.2:3000',
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Required';
                final uri = Uri.tryParse(v.trim());
                if (uri == null || !uri.hasScheme) return 'Invalid URL';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _cameraQuery,
              decoration: InputDecoration(
                labelText: 'Camera search',
                suffixIcon: IconButton(
                  onPressed: _loadingCamera ? null : _searchCameras,
                  icon: const Icon(Icons.search),
                ),
              ),
              onFieldSubmitted: (_) => _searchCameras(),
            ),
            if (_loadingCamera) const LinearProgressIndicator(),
            ..._cameraSuggestions.map(
              (s) => ListTile(
                title: Text(s.name),
                subtitle: Text('${s.sensorW} × ${s.sensorH} mm${s.pixelUm != null ? ', ${s.pixelUm} µm' : ''}'),
                onTap: () {
                  setState(() {
                    _sensorW.text = s.sensorW.toString();
                    _sensorH.text = s.sensorH.toString();
                    if (s.pixelUm != null) _pixelUm.text = s.pixelUm!.toString();
                    _cameraSuggestions = [];
                  });
                },
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _numField('Latitude', _lat, allowSigned: true, min: -90, max: 90)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Longitude', _lon, allowSigned: true, min: -180, max: 180)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('Sensor W (mm)', _sensorW, min: 0)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Sensor H (mm)', _sensorH, min: 0)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('Pixel (µm)', _pixelUm, min: 0)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Focal (mm)', _focalMm, min: 0)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('f-number', _fNum, min: 0)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Min Alt (°)', _minAlt, min: 0, max: 89)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('Max Mag', _maxMag)),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _mount,
                    decoration: const InputDecoration(labelText: 'Mount'),
                    items: const [
                      DropdownMenuItem(value: 'fixed', child: Text('Fixed')),
                      DropdownMenuItem(value: 'tracker', child: Text('Tracker')),
                      DropdownMenuItem(value: 'guided', child: Text('Guided')),
                    ],
                    onChanged: (v) => setState(() => _mount = v ?? 'tracker'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('Bortle (1-9)', _bortle, min: 1, max: 9)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Min Score (0-1)', _minScore, min: 0, max: 1)),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _targetId,
              decoration: const InputDecoration(
                labelText: 'Target ID (optional for recommendations, required for plan)',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: const Icon(Icons.schedule),
              label: Text('Session UTC: ${_date.toIso8601String()}'),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _toRecommendations,
              icon: const Icon(Icons.star),
              label: const Text('Get Recommendations'),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _toPlanner,
              icon: const Icon(Icons.calendar_month),
              label: const Text('Open Multi-night Planner'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _getPlan,
              icon: const Icon(Icons.list_alt),
              label: const Text('Plan Selected Target'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _numField(
    String label,
    TextEditingController controller, {
    bool allowSigned = false,
    double? min,
    double? max,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.numberWithOptions(decimal: true, signed: allowSigned),
      decoration: InputDecoration(labelText: label),
      validator: (value) {
        final basic = _requiredNum(value);
        if (basic != null) return basic;
        final parsed = double.parse(value!.trim());
        if (min != null && parsed < min) return 'Must be ≥ $min';
        if (max != null && parsed > max) return 'Must be ≤ $max';
        return null;
      },
    );
  }
}

enum TargetFilter { all, high, medium }
enum TargetSort { score, framing, name }

class RecommendationsPage extends StatefulWidget {
  const RecommendationsPage({super.key, required this.api, required this.params});

  final AstroApi api;
  final SetupParams params;

  @override
  State<RecommendationsPage> createState() => _RecommendationsPageState();
}

class _RecommendationsPageState extends State<RecommendationsPage> {
  bool _loading = true;
  String? _error;
  List<Recommendation> _targets = [];
  String? _contractVersion;
  String? _weatherSource;
  String? _weatherGeneratedAtUtc;
  TargetFilter _filter = TargetFilter.all;
  TargetSort _sort = TargetSort.score;
  final Set<String> _typeFilters = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await widget.api.getRecommendations(widget.params);
      if (!mounted) return;
      setState(() {
        _targets = resp.recommendedTargets;
        _contractVersion = resp.contractVersion;
        _weatherSource = resp.weatherSource;
        _weatherGeneratedAtUtc = resp.weatherGeneratedAtUtc;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Recommendation> get _filtered {
    var list = [..._targets];
    if (_typeFilters.isNotEmpty) {
      list = list.where((t) => _typeFilters.contains(t.type)).toList();
    }
    switch (_filter) {
      case TargetFilter.high:
        list = list.where((t) => t.score >= 0.7).toList();
        break;
      case TargetFilter.medium:
        list = list.where((t) => t.score >= 0.5).toList();
        break;
      case TargetFilter.all:
        break;
    }
    switch (_sort) {
      case TargetSort.score:
        list.sort((a, b) => b.score.compareTo(a.score));
        break;
      case TargetSort.framing:
        list.sort((a, b) => b.framingScore.compareTo(a.framingScore));
        break;
      case TargetSort.name:
        list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
        break;
    }
    return list;
  }

  String _formatLocalDateTime(DateTime value) {
    final date = MaterialLocalizations.of(context).formatShortDate(value);
    final time = MaterialLocalizations.of(context).formatTimeOfDay(
      TimeOfDay.fromDateTime(value),
      alwaysUse24HourFormat: true,
    );
    return '$date $time';
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final categories = _targets.map((e) => e.type).toSet().toList()..sort();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recommended Targets'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          SegmentedButton<TargetFilter>(
                            segments: const [
                              ButtonSegment(value: TargetFilter.all, label: Text('All')),
                              ButtonSegment(value: TargetFilter.high, label: Text('High')),
                              ButtonSegment(value: TargetFilter.medium, label: Text('Medium+')),
                            ],
                            selected: {_filter},
                            onSelectionChanged: (s) => setState(() => _filter = s.first),
                          ),
                          DropdownButton<TargetSort>(
                            value: _sort,
                            items: const [
                              DropdownMenuItem(value: TargetSort.score, child: Text('Sort: Score')),
                              DropdownMenuItem(value: TargetSort.framing, child: Text('Sort: Framing')),
                              DropdownMenuItem(value: TargetSort.name, child: Text('Sort: Name')),
                            ],
                            onChanged: (v) => setState(() => _sort = v ?? TargetSort.score),
                          ),
                        ],
                      ),
                    ),
                    if (_contractVersion != null || _weatherSource != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'Contract ${_contractVersion ?? '-'} • Weather: ${_weatherSource ?? '-'}${_weatherGeneratedAtUtc != null ? ' • ${_weatherGeneratedAtUtc!}' : ''}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    if (categories.isNotEmpty)
                      SizedBox(
                        height: 48,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          scrollDirection: Axis.horizontal,
                          itemCount: categories.length,
                          itemBuilder: (context, index) {
                            final type = categories[index];
                            final selected = _typeFilters.contains(type);
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: FilterChip(
                                label: Text(type),
                                selected: selected,
                                onSelected: (on) {
                                  setState(() {
                                    if (on) {
                                      _typeFilters.add(type);
                                    } else {
                                      _typeFilters.remove(type);
                                    }
                                  });
                                },
                              ),
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: filtered.isEmpty
                          ? const Center(child: Text('No targets match current filters.'))
                          : ListView.builder(
                              itemCount: filtered.length,
                              itemBuilder: (context, index) {
                                final t = filtered[index];
                                return Card(
                                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${t.name} (${t.id})',
                                          style: Theme.of(context).textTheme.titleMedium,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(t.type),
                                        const SizedBox(height: 8),
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(8),
                                          child: Image.network(
                                            widget.api.imageUrl(t.name),
                                            height: 160,
                                            width: double.infinity,
                                           fit: BoxFit.cover,
                                            errorBuilder: (context, error, stackTrace) => Container(
                                              height: 160,
                                              color: Colors.black12,
                                              alignment: Alignment.center,
                                              child: const Text('No image'),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                         Wrap(
                                           spacing: 12,
                                           runSpacing: 8,
                                           children: [
                                             Text('Score: ${(t.score * 100).toStringAsFixed(0)}%'),
                                             Text('Visibility: ${(t.visibilityScore * 100).toStringAsFixed(0)}%'),
                                             Text('Framing: ${(t.framingScore * 100).toStringAsFixed(0)}%'),
                                             Text('Fill: ${(t.fillRatio * 100).toStringAsFixed(0)}%'),
                                             Text('Visible hours: ${t.visibleHours.toStringAsFixed(1)}h'),
                                           ],
                                         ),
                                         if (t.scoreBreakdown != null)
                                           Text(
                                             'Breakdown → V ${(t.scoreBreakdown!.visibility * 100).toStringAsFixed(0)}% • F ${(t.scoreBreakdown!.framing * 100).toStringAsFixed(0)}% • S ${(t.scoreBreakdown!.season * 100).toStringAsFixed(0)}% • M ${(t.scoreBreakdown!.moon * 100).toStringAsFixed(0)}% • W ${(t.scoreBreakdown!.weather * 100).toStringAsFixed(0)}%',
                                           ),
                                         if (t.moon != null)
                                           Text(
                                             'Moon → illum ${(t.moon!.illuminationFraction * 100).toStringAsFixed(0)}% • above ${(t.moon!.aboveHorizonFraction * 100).toStringAsFixed(0)}% • sep ${t.moon!.averageSeparationDeg?.toStringAsFixed(1) ?? '-'}°',
                                           ),
                                         if (t.weather != null)
                                           Text(
                                             'Weather → cloud ${t.weather!.avgCloudPct?.toStringAsFixed(1) ?? '-'}% • confidence ${t.weather!.confidence} (${t.weather!.sampleHours}h)',
                                           ),
                                        if (t.window != null) ...[
                                          const SizedBox(height: 8),
                                          Text(
                                            'Visible: ${_formatLocalDateTime(t.window!.startUtc)} → ${_formatLocalDateTime(t.window!.endUtc)}',
                                          ),
                                          Text('Max altitude: ${t.window!.altMaxDeg.toStringAsFixed(1)}°'),
                                        ],
                                        const SizedBox(height: 8),
                                        Text(
                                          'Capture: ${t.suggestedCapture.subExposureS}s, Gain ${t.suggestedCapture.gain}, Subs ${t.suggestedCapture.subs}',
                                        ),
                                        if (t.suggestedCapture.notes.isNotEmpty)
                                          Text(
                                            t.suggestedCapture.notes,
                                            style: const TextStyle(fontStyle: FontStyle.italic),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}

class PlannerPage extends StatefulWidget {
  const PlannerPage({super.key, required this.api, required this.params});

  final AstroApi api;
  final SetupParams params;

  @override
  State<PlannerPage> createState() => _PlannerPageState();
}

class _PlannerPageState extends State<PlannerPage> {
  bool _loading = true;
  String? _error;
  PlannerResponse? _response;
  String _range = 'week';
  String _typeFilter = '';
  double _minScore = 0.4;
  double _minAlt = 10;

  @override
  void initState() {
    super.initState();
    _minScore = widget.params.minScore;
    _minAlt = widget.params.minAlt;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.api.getPlanner(
        widget.params,
        range: _range,
        typeFilter: _typeFilter,
        minScore: _minScore,
        minAlt: _minAlt,
      );
      if (!mounted) return;
      setState(() => _response = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final nights = _response?.nights ?? const <PlannerNight>[];
    final totalWindows = nights.fold<int>(0, (sum, n) => sum + n.bestWindows.length);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Multi-night Planner'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: DropdownButtonFormField<String>(
                                  value: _range,
                                  decoration: const InputDecoration(labelText: 'Range'),
                                  items: const [
                                    DropdownMenuItem(value: 'week', child: Text('Week')),
                                    DropdownMenuItem(value: 'month', child: Text('Month')),
                                    DropdownMenuItem(value: 'season', child: Text('Season')),
                                  ],
                                  onChanged: (v) => setState(() => _range = v ?? 'week'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  initialValue: _typeFilter,
                                  decoration: const InputDecoration(labelText: 'Type filter'),
                                  onChanged: (v) => _typeFilter = v,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: Slider(
                                  value: _minScore.clamp(0, 1),
                                  min: 0,
                                  max: 1,
                                  divisions: 20,
                                  label: 'Min score ${(100 * _minScore).toStringAsFixed(0)}%',
                                  onChanged: (v) => setState(() => _minScore = v),
                                ),
                              ),
                              Expanded(
                                child: Slider(
                                  value: _minAlt.clamp(0, 40),
                                  min: 0,
                                  max: 40,
                                  divisions: 40,
                                  label: 'Min alt ${_minAlt.toStringAsFixed(0)}°',
                                  onChanged: (v) => setState(() => _minAlt = v),
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              Text('${nights.length} nights • $totalWindows windows'),
                              const Spacer(),
                              FilledButton(
                                onPressed: _load,
                                child: const Text('Apply'),
                              ),
                            ],
                          ),
                          if (_response?.contractVersion != null || _response?.weatherSource != null)
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'Contract ${_response?.contractVersion ?? '-'} • Weather: ${_response?.weatherSource ?? '-'}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    Expanded(
                      child: nights.isEmpty
                          ? const Center(child: Text('No planner results for current filters.'))
                          : ListView.builder(
                              itemCount: nights.length,
                              itemBuilder: (context, nightIndex) {
                                final night = nights[nightIndex];
                                return ExpansionTile(
                                  title: Text(MaterialLocalizations.of(context).formatMediumDate(night.dateUtc)),
                                  subtitle: Text('${night.bestWindows.length} windows'),
                                  children: [
                                    for (final item in night.bestWindows)
                                      ListTile(
                                        title: Text('${item.name} (${(item.score * 100).toStringAsFixed(0)}%)'),
                                        subtitle: Text(
                                          '${item.type} • ${item.window != null ? '${item.window!.altMaxDeg.toStringAsFixed(1)}° max' : 'No window'}',
                                        ),
                                      ),
                                  ],
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}
