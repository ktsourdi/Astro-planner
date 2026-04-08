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
    required this.suggestedCapture,
    required this.window,
  });

  final String id;
  final String name;
  final String type;
  final double fillRatio;
  final double framingScore;
  final double score;
  final SuggestedCapture suggestedCapture;
  final VisibilityWindow? window;

  factory Recommendation.fromJson(Map<String, dynamic> json) => Recommendation(
        id: (json['id'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        type: (json['type'] ?? '').toString(),
        fillRatio: (json['fill_ratio'] as num?)?.toDouble() ?? 0,
        framingScore: (json['framing_score'] as num?)?.toDouble() ?? 0,
        score: (json['score'] as num?)?.toDouble() ?? 0,
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

class RecommendResponse {
  RecommendResponse({required this.recommendedTargets});

  final List<Recommendation> recommendedTargets;

  factory RecommendResponse.fromJson(Map<String, dynamic> json) {
    final list = (json['recommended_targets'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(Recommendation.fromJson)
        .toList();
    return RecommendResponse(recommendedTargets: list);
  }
}

class AstroApi {
  AstroApi(this.baseUrl);

  final String baseUrl;

  Uri _uri(String path, [Map<String, String>? query]) {
    final root = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    return Uri.parse('$root$path').replace(queryParameters: query);
  }

  Future<List<CameraSuggestion>> searchCameras(String query) async {
    final uri = _uri('/api/camera', {'query': query});
    final resp = await http.get(uri);
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
    final resp = await http.get(uri);
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
    final resp = await http.get(uri);
    if (resp.statusCode != 200) {
      throw Exception('Plan failed (${resp.statusCode}): ${resp.body}');
    }
    return const JsonEncoder.withIndent('  ')
        .convert(jsonDecode(resp.body) as Map<String, dynamic>);
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
  final _targetId = TextEditingController();
  final _cameraQuery = TextEditingController();

  DateTime _date = DateTime.now().toUtc();
  String _mount = 'tracker';
  bool _loadingCamera = false;
  List<CameraSuggestion> _cameraSuggestions = [];

  AstroApi get _api => AstroApi(_baseUrl.text.trim());

  static String _defaultBaseUrl() {
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
                Expanded(child: _numField('Latitude', _lat)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Longitude', _lon)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('Sensor W (mm)', _sensorW)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Sensor H (mm)', _sensorH)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('Pixel (µm)', _pixelUm)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Focal (mm)', _focalMm)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _numField('f-number', _fNum)),
                const SizedBox(width: 12),
                Expanded(child: _numField('Min Alt (°)', _minAlt)),
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

  Widget _numField(String label, TextEditingController controller) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.numberWithOptions(decimal: true, signed: true),
      decoration: InputDecoration(labelText: label),
      validator: _requiredNum,
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
      setState(() => _targets = resp.recommendedTargets);
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
                                            Text('Framing: ${(t.framingScore * 100).toStringAsFixed(0)}%'),
                                            Text('Fill: ${(t.fillRatio * 100).toStringAsFixed(0)}%'),
                                          ],
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
