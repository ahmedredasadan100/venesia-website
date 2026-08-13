-- Canonicalize legacy Project media in the existing Media Catalog identity.
-- The public files remain read-only deployment assets; Media Catalog owns their durable identity.
-- Generated from the 270 tracked assets present at this migration baseline.

begin;

alter table public.media_assets
  drop constraint if exists media_assets_provider_check;

alter table public.media_assets
  add constraint media_assets_provider_check
  check (provider in ('supabase', 'filesystem'));

create temporary table legacy_project_media_seed (
  object_key text primary key,
  public_url text not null unique,
  folder_path text not null,
  original_filename text not null,
  extension text not null,
  mime_type text not null,
  byte_size bigint not null,
  checksum text not null
) on commit drop;

insert into legacy_project_media_seed (
  object_key,
  public_url,
  folder_path,
  original_filename,
  extension,
  mime_type,
  byte_size,
  checksum
)
values
  ('images/6666.png', '/images/6666.png', 'images', '6666.png', 'png', 'image/png', 2834470, 'e8ed96488fc1795f6cd173bd5b94827714d29a043dea791d5cb12285479cc57f'),
  ('images/cta-building-night.png', '/images/cta-building-night.png', 'images', 'cta-building-night.png', 'png', 'image/png', 1219775, '28f7484512430e77b914f82ba77b1973ed169168e679b791d5e932994b622a25'),
  ('images/projects/B137/cover.jpg', '/images/projects/B137/cover.jpg', 'images/projects/B137', 'cover.jpg', 'jpg', 'image/jpeg', 109989, '60f707722b97b1085d6f0f29a235dd543796c2e2172ba17c17683efcda4738b0'),
  ('images/projects/B137/floorplan-01.jpg', '/images/projects/B137/floorplan-01.jpg', 'images/projects/B137', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/B137/floorplan-02.jpg', '/images/projects/B137/floorplan-02.jpg', 'images/projects/B137', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/B137/floorplan-03.jpg', '/images/projects/B137/floorplan-03.jpg', 'images/projects/B137', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/B137/floorplan-04.jpg', '/images/projects/B137/floorplan-04.jpg', 'images/projects/B137', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/B137/gallery-01.jpg', '/images/projects/B137/gallery-01.jpg', 'images/projects/B137', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/B137/gallery-02.jpg', '/images/projects/B137/gallery-02.jpg', 'images/projects/B137', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/B137/gallery-03.jpg', '/images/projects/B137/gallery-03.jpg', 'images/projects/B137', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/B137/gallery-04.jpg', '/images/projects/B137/gallery-04.jpg', 'images/projects/B137', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/B137/hero.jpg', '/images/projects/B137/hero.jpg', 'images/projects/B137', 'hero.jpg', 'jpg', 'image/jpeg', 109411, '9a6e933db08d82e19bd6b7e704931c80ca626c36afe503f31f3a731ac52a8af6'),
  ('images/projects/B137/location-map.jpg', '/images/projects/B137/location-map.jpg', 'images/projects/B137', 'location-map.jpg', 'jpg', 'image/jpeg', 2469714, '97c2acd2f26ce20732bce76cdfdd1533fc6e49e3b5161755ac637773f1711db4'),
  ('images/projects/B137/progress-01.jpg', '/images/projects/B137/progress-01.jpg', 'images/projects/B137', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B137/progress-02.jpg', '/images/projects/B137/progress-02.jpg', 'images/projects/B137', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B137/progress-03.jpg', '/images/projects/B137/progress-03.jpg', 'images/projects/B137', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B137/progress-04.jpg', '/images/projects/B137/progress-04.jpg', 'images/projects/B137', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B137/progress-05.jpg', '/images/projects/B137/progress-05.jpg', 'images/projects/B137', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B137/specs-01.jpg', '/images/projects/B137/specs-01.jpg', 'images/projects/B137', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/B137/specs-02.jpg', '/images/projects/B137/specs-02.jpg', 'images/projects/B137', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/B137/specs-03.jpg', '/images/projects/B137/specs-03.jpg', 'images/projects/B137', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/B137/specs-04.jpg', '/images/projects/B137/specs-04.jpg', 'images/projects/B137', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/B137/specs-05.jpg', '/images/projects/B137/specs-05.jpg', 'images/projects/B137', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/B138/cover.jpg', '/images/projects/B138/cover.jpg', 'images/projects/B138', 'cover.jpg', 'jpg', 'image/jpeg', 105496, '7da5a2c9f43821c7dd275017f40f0c1d59d03489fb7ccc0702ae105f10f26a8a'),
  ('images/projects/B138/floorplan-01.jpg', '/images/projects/B138/floorplan-01.jpg', 'images/projects/B138', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/B138/floorplan-02.jpg', '/images/projects/B138/floorplan-02.jpg', 'images/projects/B138', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/B138/floorplan-03.jpg', '/images/projects/B138/floorplan-03.jpg', 'images/projects/B138', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/B138/floorplan-04.jpg', '/images/projects/B138/floorplan-04.jpg', 'images/projects/B138', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/B138/gallery-01.jpg', '/images/projects/B138/gallery-01.jpg', 'images/projects/B138', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/B138/gallery-02.jpg', '/images/projects/B138/gallery-02.jpg', 'images/projects/B138', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/B138/gallery-03.jpg', '/images/projects/B138/gallery-03.jpg', 'images/projects/B138', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/B138/gallery-04.jpg', '/images/projects/B138/gallery-04.jpg', 'images/projects/B138', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/B138/hero.jpg', '/images/projects/B138/hero.jpg', 'images/projects/B138', 'hero.jpg', 'jpg', 'image/jpeg', 115488, '73760ed1b1b4ab45f7a0eac0669c82ade0feb65365df907f074df098062d08bc'),
  ('images/projects/B138/location-map.jpg', '/images/projects/B138/location-map.jpg', 'images/projects/B138', 'location-map.jpg', 'jpg', 'image/jpeg', 2469714, '97c2acd2f26ce20732bce76cdfdd1533fc6e49e3b5161755ac637773f1711db4'),
  ('images/projects/B138/progress-01.jpg', '/images/projects/B138/progress-01.jpg', 'images/projects/B138', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B138/progress-02.jpg', '/images/projects/B138/progress-02.jpg', 'images/projects/B138', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B138/progress-03.jpg', '/images/projects/B138/progress-03.jpg', 'images/projects/B138', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B138/progress-04.jpg', '/images/projects/B138/progress-04.jpg', 'images/projects/B138', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B138/progress-05.jpg', '/images/projects/B138/progress-05.jpg', 'images/projects/B138', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B138/specs-01.jpg', '/images/projects/B138/specs-01.jpg', 'images/projects/B138', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/B138/specs-02.jpg', '/images/projects/B138/specs-02.jpg', 'images/projects/B138', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/B138/specs-03.jpg', '/images/projects/B138/specs-03.jpg', 'images/projects/B138', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/B138/specs-04.jpg', '/images/projects/B138/specs-04.jpg', 'images/projects/B138', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/B138/specs-05.jpg', '/images/projects/B138/specs-05.jpg', 'images/projects/B138', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/B84/cover.jpg', '/images/projects/B84/cover.jpg', 'images/projects/B84', 'cover.jpg', 'jpg', 'image/jpeg', 1131967, '261972c8faa2d7b4c8a54b388d14874e1d980089e718b819cd2f497ebbcf689d'),
  ('images/projects/B84/floorplan-01.jpg', '/images/projects/B84/floorplan-01.jpg', 'images/projects/B84', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/B84/floorplan-02.jpg', '/images/projects/B84/floorplan-02.jpg', 'images/projects/B84', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/B84/floorplan-03.jpg', '/images/projects/B84/floorplan-03.jpg', 'images/projects/B84', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/B84/floorplan-04.jpg', '/images/projects/B84/floorplan-04.jpg', 'images/projects/B84', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/B84/gallery-01.jpg', '/images/projects/B84/gallery-01.jpg', 'images/projects/B84', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/B84/gallery-02.jpg', '/images/projects/B84/gallery-02.jpg', 'images/projects/B84', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/B84/gallery-03.jpg', '/images/projects/B84/gallery-03.jpg', 'images/projects/B84', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/B84/gallery-04.jpg', '/images/projects/B84/gallery-04.jpg', 'images/projects/B84', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/B84/hero.jpg', '/images/projects/B84/hero.jpg', 'images/projects/B84', 'hero.jpg', 'jpg', 'image/jpeg', 838746, 'f6820d3216d1e2d7f25fe14a3ff9bb4a728c37b8cb949397b556ec41cb9447cc'),
  ('images/projects/B84/location-map.jpg', '/images/projects/B84/location-map.jpg', 'images/projects/B84', 'location-map.jpg', 'jpg', 'image/jpeg', 3109321, 'b556282d86b07a23f2f3ee2f82b3282290b9c094b6782cd4c2bb100725bdb2eb'),
  ('images/projects/B84/progress-01 - Copy (2).jpg', '/images/projects/B84/progress-01 - Copy (2).jpg', 'images/projects/B84', 'progress-01 - Copy (2).jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B84/progress-01 - Copy (3).jpg', '/images/projects/B84/progress-01 - Copy (3).jpg', 'images/projects/B84', 'progress-01 - Copy (3).jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B84/progress-01 - Copy (4).jpg', '/images/projects/B84/progress-01 - Copy (4).jpg', 'images/projects/B84', 'progress-01 - Copy (4).jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B84/progress-01 - Copy (5).jpg', '/images/projects/B84/progress-01 - Copy (5).jpg', 'images/projects/B84', 'progress-01 - Copy (5).jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B84/progress-01 - Copy (6).jpg', '/images/projects/B84/progress-01 - Copy (6).jpg', 'images/projects/B84', 'progress-01 - Copy (6).jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B84/progress-01 - Copy.jpg', '/images/projects/B84/progress-01 - Copy.jpg', 'images/projects/B84', 'progress-01 - Copy.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B84/progress-01.jpg', '/images/projects/B84/progress-01.jpg', 'images/projects/B84', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/B84/progress-02 - Copy (2).jpg', '/images/projects/B84/progress-02 - Copy (2).jpg', 'images/projects/B84', 'progress-02 - Copy (2).jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B84/progress-02 - Copy (3).jpg', '/images/projects/B84/progress-02 - Copy (3).jpg', 'images/projects/B84', 'progress-02 - Copy (3).jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B84/progress-02 - Copy (4).jpg', '/images/projects/B84/progress-02 - Copy (4).jpg', 'images/projects/B84', 'progress-02 - Copy (4).jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B84/progress-02 - Copy (5).jpg', '/images/projects/B84/progress-02 - Copy (5).jpg', 'images/projects/B84', 'progress-02 - Copy (5).jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B84/progress-02 - Copy (6).jpg', '/images/projects/B84/progress-02 - Copy (6).jpg', 'images/projects/B84', 'progress-02 - Copy (6).jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B84/progress-02 - Copy.jpg', '/images/projects/B84/progress-02 - Copy.jpg', 'images/projects/B84', 'progress-02 - Copy.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B84/progress-02.jpg', '/images/projects/B84/progress-02.jpg', 'images/projects/B84', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/B84/progress-03 - Copy (2).jpg', '/images/projects/B84/progress-03 - Copy (2).jpg', 'images/projects/B84', 'progress-03 - Copy (2).jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B84/progress-03 - Copy (3).jpg', '/images/projects/B84/progress-03 - Copy (3).jpg', 'images/projects/B84', 'progress-03 - Copy (3).jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B84/progress-03 - Copy (4).jpg', '/images/projects/B84/progress-03 - Copy (4).jpg', 'images/projects/B84', 'progress-03 - Copy (4).jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B84/progress-03 - Copy (5).jpg', '/images/projects/B84/progress-03 - Copy (5).jpg', 'images/projects/B84', 'progress-03 - Copy (5).jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B84/progress-03 - Copy (6).jpg', '/images/projects/B84/progress-03 - Copy (6).jpg', 'images/projects/B84', 'progress-03 - Copy (6).jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B84/progress-03 - Copy.jpg', '/images/projects/B84/progress-03 - Copy.jpg', 'images/projects/B84', 'progress-03 - Copy.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B84/progress-03.jpg', '/images/projects/B84/progress-03.jpg', 'images/projects/B84', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/B84/progress-04 - Copy (2).jpg', '/images/projects/B84/progress-04 - Copy (2).jpg', 'images/projects/B84', 'progress-04 - Copy (2).jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B84/progress-04 - Copy (3).jpg', '/images/projects/B84/progress-04 - Copy (3).jpg', 'images/projects/B84', 'progress-04 - Copy (3).jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B84/progress-04 - Copy (4).jpg', '/images/projects/B84/progress-04 - Copy (4).jpg', 'images/projects/B84', 'progress-04 - Copy (4).jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B84/progress-04 - Copy (5).jpg', '/images/projects/B84/progress-04 - Copy (5).jpg', 'images/projects/B84', 'progress-04 - Copy (5).jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B84/progress-04 - Copy (6).jpg', '/images/projects/B84/progress-04 - Copy (6).jpg', 'images/projects/B84', 'progress-04 - Copy (6).jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B84/progress-04 - Copy.jpg', '/images/projects/B84/progress-04 - Copy.jpg', 'images/projects/B84', 'progress-04 - Copy.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B84/progress-04.jpg', '/images/projects/B84/progress-04.jpg', 'images/projects/B84', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/B84/progress-05 - Copy (2).jpg', '/images/projects/B84/progress-05 - Copy (2).jpg', 'images/projects/B84', 'progress-05 - Copy (2).jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B84/progress-05 - Copy (3).jpg', '/images/projects/B84/progress-05 - Copy (3).jpg', 'images/projects/B84', 'progress-05 - Copy (3).jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B84/progress-05 - Copy (4).jpg', '/images/projects/B84/progress-05 - Copy (4).jpg', 'images/projects/B84', 'progress-05 - Copy (4).jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B84/progress-05 - Copy (5).jpg', '/images/projects/B84/progress-05 - Copy (5).jpg', 'images/projects/B84', 'progress-05 - Copy (5).jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B84/progress-05 - Copy (6).jpg', '/images/projects/B84/progress-05 - Copy (6).jpg', 'images/projects/B84', 'progress-05 - Copy (6).jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B84/progress-05 - Copy.jpg', '/images/projects/B84/progress-05 - Copy.jpg', 'images/projects/B84', 'progress-05 - Copy.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B84/progress-05.jpg', '/images/projects/B84/progress-05.jpg', 'images/projects/B84', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/B84/specs-01.jpg', '/images/projects/B84/specs-01.jpg', 'images/projects/B84', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/B84/specs-02.jpg', '/images/projects/B84/specs-02.jpg', 'images/projects/B84', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/B84/specs-03.jpg', '/images/projects/B84/specs-03.jpg', 'images/projects/B84', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/B84/specs-04.jpg', '/images/projects/B84/specs-04.jpg', 'images/projects/B84', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/B84/specs-05.jpg', '/images/projects/B84/specs-05.jpg', 'images/projects/B84', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/C35/cover.jpg', '/images/projects/C35/cover.jpg', 'images/projects/C35', 'cover.jpg', 'jpg', 'image/jpeg', 550532, '7e750cfd818c7d3eee1bb6a78f7d4d7a5f108d67a7813957669229eb74f2a79b'),
  ('images/projects/C35/floorplan-01.jpg', '/images/projects/C35/floorplan-01.jpg', 'images/projects/C35', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/C35/floorplan-02.jpg', '/images/projects/C35/floorplan-02.jpg', 'images/projects/C35', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/C35/floorplan-03.jpg', '/images/projects/C35/floorplan-03.jpg', 'images/projects/C35', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/C35/floorplan-04.jpg', '/images/projects/C35/floorplan-04.jpg', 'images/projects/C35', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/C35/gallery-01.jpg', '/images/projects/C35/gallery-01.jpg', 'images/projects/C35', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/C35/gallery-02.jpg', '/images/projects/C35/gallery-02.jpg', 'images/projects/C35', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/C35/gallery-03.jpg', '/images/projects/C35/gallery-03.jpg', 'images/projects/C35', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/C35/gallery-04.jpg', '/images/projects/C35/gallery-04.jpg', 'images/projects/C35', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/C35/hero.jpg', '/images/projects/C35/hero.jpg', 'images/projects/C35', 'hero.jpg', 'jpg', 'image/jpeg', 502238, 'cf60677938acaeef1c835f56fac83f8f0d864f9d7813866d5cc21b02c87f7b04'),
  ('images/projects/C35/location-map.jpg', '/images/projects/C35/location-map.jpg', 'images/projects/C35', 'location-map.jpg', 'jpg', 'image/jpeg', 3019721, '9191bad2812640c81d890697076ba1853a90f8301cc743970a98f58ff5e1ac3f'),
  ('images/projects/C35/progress-01.jpg', '/images/projects/C35/progress-01.jpg', 'images/projects/C35', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/C35/progress-02.jpg', '/images/projects/C35/progress-02.jpg', 'images/projects/C35', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/C35/progress-03.jpg', '/images/projects/C35/progress-03.jpg', 'images/projects/C35', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/C35/progress-04.jpg', '/images/projects/C35/progress-04.jpg', 'images/projects/C35', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/C35/progress-05.jpg', '/images/projects/C35/progress-05.jpg', 'images/projects/C35', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/C35/specs-01.jpg', '/images/projects/C35/specs-01.jpg', 'images/projects/C35', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/C35/specs-02.jpg', '/images/projects/C35/specs-02.jpg', 'images/projects/C35', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/C35/specs-03.jpg', '/images/projects/C35/specs-03.jpg', 'images/projects/C35', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/C35/specs-04.jpg', '/images/projects/C35/specs-04.jpg', 'images/projects/C35', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/C35/specs-05.jpg', '/images/projects/C35/specs-05.jpg', 'images/projects/C35', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/F222/cover.jpg', '/images/projects/F222/cover.jpg', 'images/projects/F222', 'cover.jpg', 'jpg', 'image/jpeg', 243698, '6e9b22035b059d87d75283fe007770907b1bfbb6d9149de19ecb549fc476eba6'),
  ('images/projects/F222/floorplan-01.jpg', '/images/projects/F222/floorplan-01.jpg', 'images/projects/F222', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/F222/floorplan-02.jpg', '/images/projects/F222/floorplan-02.jpg', 'images/projects/F222', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/F222/floorplan-03.jpg', '/images/projects/F222/floorplan-03.jpg', 'images/projects/F222', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/F222/floorplan-04.jpg', '/images/projects/F222/floorplan-04.jpg', 'images/projects/F222', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/F222/gallery-01.jpg', '/images/projects/F222/gallery-01.jpg', 'images/projects/F222', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/F222/gallery-02.jpg', '/images/projects/F222/gallery-02.jpg', 'images/projects/F222', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/F222/gallery-03.jpg', '/images/projects/F222/gallery-03.jpg', 'images/projects/F222', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/F222/gallery-04.jpg', '/images/projects/F222/gallery-04.jpg', 'images/projects/F222', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/F222/hero-1.jpg', '/images/projects/F222/hero-1.jpg', 'images/projects/F222', 'hero-1.jpg', 'jpg', 'image/jpeg', 388059, 'a3170adbeee8796b0c63b6b852b64c6b605f79cf66185b33b033c2d19b3acac0'),
  ('images/projects/F222/hero-2.jpg', '/images/projects/F222/hero-2.jpg', 'images/projects/F222', 'hero-2.jpg', 'jpg', 'image/jpeg', 388059, 'a3170adbeee8796b0c63b6b852b64c6b605f79cf66185b33b033c2d19b3acac0'),
  ('images/projects/F222/hero.jpg', '/images/projects/F222/hero.jpg', 'images/projects/F222', 'hero.jpg', 'jpg', 'image/jpeg', 234180, 'a91e3f38195f080bf25cccd4be5ced71babfec0149359959c0c1fcc0388caa4d'),
  ('images/projects/F222/location-map.jpg', '/images/projects/F222/location-map.jpg', 'images/projects/F222', 'location-map.jpg', 'jpg', 'image/jpeg', 3135349, 'a4dc83af0352894fb633b82543add908bf23746b62ed9d63d5f78d3ae23e77be'),
  ('images/projects/F222/progress-01.jpg', '/images/projects/F222/progress-01.jpg', 'images/projects/F222', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/F222/progress-02.jpg', '/images/projects/F222/progress-02.jpg', 'images/projects/F222', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/F222/progress-03.jpg', '/images/projects/F222/progress-03.jpg', 'images/projects/F222', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/F222/progress-04.jpg', '/images/projects/F222/progress-04.jpg', 'images/projects/F222', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/F222/progress-05.jpg', '/images/projects/F222/progress-05.jpg', 'images/projects/F222', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/F222/specs-01.jpg', '/images/projects/F222/specs-01.jpg', 'images/projects/F222', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/F222/specs-02.jpg', '/images/projects/F222/specs-02.jpg', 'images/projects/F222', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/F222/specs-03.jpg', '/images/projects/F222/specs-03.jpg', 'images/projects/F222', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/F222/specs-04.jpg', '/images/projects/F222/specs-04.jpg', 'images/projects/F222', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/F222/specs-05.jpg', '/images/projects/F222/specs-05.jpg', 'images/projects/F222', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/F92/cover.jpg', '/images/projects/F92/cover.jpg', 'images/projects/F92', 'cover.jpg', 'jpg', 'image/jpeg', 318155, '3c31d233d543d19134edeee9401d7b337d74832d2917f4825a29fbaf3095f62c'),
  ('images/projects/F92/floorplan-01.jpg', '/images/projects/F92/floorplan-01.jpg', 'images/projects/F92', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/F92/floorplan-02.jpg', '/images/projects/F92/floorplan-02.jpg', 'images/projects/F92', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/F92/floorplan-03.jpg', '/images/projects/F92/floorplan-03.jpg', 'images/projects/F92', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/F92/floorplan-04.jpg', '/images/projects/F92/floorplan-04.jpg', 'images/projects/F92', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/F92/gallery-01.jpg', '/images/projects/F92/gallery-01.jpg', 'images/projects/F92', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/F92/gallery-02.jpg', '/images/projects/F92/gallery-02.jpg', 'images/projects/F92', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/F92/gallery-03.jpg', '/images/projects/F92/gallery-03.jpg', 'images/projects/F92', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/F92/gallery-04.jpg', '/images/projects/F92/gallery-04.jpg', 'images/projects/F92', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/F92/hero.jpg', '/images/projects/F92/hero.jpg', 'images/projects/F92', 'hero.jpg', 'jpg', 'image/jpeg', 291773, '12953c1ceaa44687adde672e61418466fa581b1723f7ab0ada2f5a4c9829abaf'),
  ('images/projects/F92/location-map.jpg', '/images/projects/F92/location-map.jpg', 'images/projects/F92', 'location-map.jpg', 'jpg', 'image/jpeg', 3135349, 'a4dc83af0352894fb633b82543add908bf23746b62ed9d63d5f78d3ae23e77be'),
  ('images/projects/F92/overview-01.jpg', '/images/projects/F92/overview-01.jpg', 'images/projects/F92', 'overview-01.jpg', 'jpg', 'image/jpeg', 468490, '75e0c6bfc1bfa8bf261e535c498c2f632027a3cc8206a63bbaf355d97fd6f50d'),
  ('images/projects/F92/overview-02.jpg', '/images/projects/F92/overview-02.jpg', 'images/projects/F92', 'overview-02.jpg', 'jpg', 'image/jpeg', 439189, 'b930c547638dbbaeee217b5a8b5cc19a9e96cd8450ce8e92ae548d3e584af071'),
  ('images/projects/F92/overview-033.jpg', '/images/projects/F92/overview-033.jpg', 'images/projects/F92', 'overview-033.jpg', 'jpg', 'image/jpeg', 485834, '9c78492d122230c4cda894ffd308ae099de8b853232d2507060e29e22591963a'),
  ('images/projects/F92/progress-01.jpg', '/images/projects/F92/progress-01.jpg', 'images/projects/F92', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/F92/progress-02.jpg', '/images/projects/F92/progress-02.jpg', 'images/projects/F92', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/F92/progress-03.jpg', '/images/projects/F92/progress-03.jpg', 'images/projects/F92', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/F92/progress-04.jpg', '/images/projects/F92/progress-04.jpg', 'images/projects/F92', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/F92/progress-05.jpg', '/images/projects/F92/progress-05.jpg', 'images/projects/F92', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/F92/specs-01.jpg', '/images/projects/F92/specs-01.jpg', 'images/projects/F92', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/F92/specs-02.jpg', '/images/projects/F92/specs-02.jpg', 'images/projects/F92', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/F92/specs-03.jpg', '/images/projects/F92/specs-03.jpg', 'images/projects/F92', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/F92/specs-04.jpg', '/images/projects/F92/specs-04.jpg', 'images/projects/F92', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/F92/specs-05.jpg', '/images/projects/F92/specs-05.jpg', 'images/projects/F92', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/I87/cover.jpg', '/images/projects/I87/cover.jpg', 'images/projects/I87', 'cover.jpg', 'jpg', 'image/jpeg', 407822, '07864fde3ca640a209e94360bc7a24c4eb3b375f85e976ed2dda99f0ede8064a'),
  ('images/projects/I87/floorplan-01.jpg', '/images/projects/I87/floorplan-01.jpg', 'images/projects/I87', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/I87/floorplan-02.jpg', '/images/projects/I87/floorplan-02.jpg', 'images/projects/I87', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/I87/floorplan-03.jpg', '/images/projects/I87/floorplan-03.jpg', 'images/projects/I87', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/I87/floorplan-04.jpg', '/images/projects/I87/floorplan-04.jpg', 'images/projects/I87', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/I87/gallery-01.jpg', '/images/projects/I87/gallery-01.jpg', 'images/projects/I87', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/I87/gallery-02.jpg', '/images/projects/I87/gallery-02.jpg', 'images/projects/I87', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/I87/gallery-03.jpg', '/images/projects/I87/gallery-03.jpg', 'images/projects/I87', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/I87/gallery-04.jpg', '/images/projects/I87/gallery-04.jpg', 'images/projects/I87', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/I87/hero.jpg', '/images/projects/I87/hero.jpg', 'images/projects/I87', 'hero.jpg', 'jpg', 'image/jpeg', 465527, 'e946d6720a255687fa6ad79952e11edcd65c02e2f1543fbd309bc8eff4578924'),
  ('images/projects/I87/location-map.jpg', '/images/projects/I87/location-map.jpg', 'images/projects/I87', 'location-map.jpg', 'jpg', 'image/jpeg', 3109321, 'b556282d86b07a23f2f3ee2f82b3282290b9c094b6782cd4c2bb100725bdb2eb'),
  ('images/projects/I87/overview-01.jpg', '/images/projects/I87/overview-01.jpg', 'images/projects/I87', 'overview-01.jpg', 'jpg', 'image/jpeg', 468490, '75e0c6bfc1bfa8bf261e535c498c2f632027a3cc8206a63bbaf355d97fd6f50d'),
  ('images/projects/I87/progress-01.jpg', '/images/projects/I87/progress-01.jpg', 'images/projects/I87', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/I87/progress-02.jpg', '/images/projects/I87/progress-02.jpg', 'images/projects/I87', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/I87/progress-03.jpg', '/images/projects/I87/progress-03.jpg', 'images/projects/I87', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/I87/progress-04.jpg', '/images/projects/I87/progress-04.jpg', 'images/projects/I87', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/I87/progress-05.jpg', '/images/projects/I87/progress-05.jpg', 'images/projects/I87', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/I87/specs-01.jpg', '/images/projects/I87/specs-01.jpg', 'images/projects/I87', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/I87/specs-02.jpg', '/images/projects/I87/specs-02.jpg', 'images/projects/I87', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/I87/specs-03.jpg', '/images/projects/I87/specs-03.jpg', 'images/projects/I87', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/I87/specs-04.jpg', '/images/projects/I87/specs-04.jpg', 'images/projects/I87', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/I87/specs-05.jpg', '/images/projects/I87/specs-05.jpg', 'images/projects/I87', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/J118/cover.jpg', '/images/projects/J118/cover.jpg', 'images/projects/J118', 'cover.jpg', 'jpg', 'image/jpeg', 458339, '85fcafeab2e3c204cf90a43cf6aead21ec792369455c7860791c3d122ce15c09'),
  ('images/projects/J118/floorplan-01.jpg', '/images/projects/J118/floorplan-01.jpg', 'images/projects/J118', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/J118/floorplan-02.jpg', '/images/projects/J118/floorplan-02.jpg', 'images/projects/J118', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/J118/floorplan-03.jpg', '/images/projects/J118/floorplan-03.jpg', 'images/projects/J118', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/J118/floorplan-04.jpg', '/images/projects/J118/floorplan-04.jpg', 'images/projects/J118', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/J118/gallery-01.jpg', '/images/projects/J118/gallery-01.jpg', 'images/projects/J118', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/J118/gallery-02.jpg', '/images/projects/J118/gallery-02.jpg', 'images/projects/J118', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/J118/gallery-03.jpg', '/images/projects/J118/gallery-03.jpg', 'images/projects/J118', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/J118/gallery-04.jpg', '/images/projects/J118/gallery-04.jpg', 'images/projects/J118', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/J118/hero.jpg', '/images/projects/J118/hero.jpg', 'images/projects/J118', 'hero.jpg', 'jpg', 'image/jpeg', 475591, '98612103f74e3165758081e5bdda27495c1f3b99dc1436758da0bde783e47e6c'),
  ('images/projects/J118/location-map.jpg', '/images/projects/J118/location-map.jpg', 'images/projects/J118', 'location-map.jpg', 'jpg', 'image/jpeg', 3019721, '9191bad2812640c81d890697076ba1853a90f8301cc743970a98f58ff5e1ac3f'),
  ('images/projects/J118/progress-01.jpg', '/images/projects/J118/progress-01.jpg', 'images/projects/J118', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/J118/progress-02.jpg', '/images/projects/J118/progress-02.jpg', 'images/projects/J118', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/J118/progress-03.jpg', '/images/projects/J118/progress-03.jpg', 'images/projects/J118', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/J118/progress-04.jpg', '/images/projects/J118/progress-04.jpg', 'images/projects/J118', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/J118/progress-05.jpg', '/images/projects/J118/progress-05.jpg', 'images/projects/J118', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/J118/specs-01.jpg', '/images/projects/J118/specs-01.jpg', 'images/projects/J118', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/J118/specs-02.jpg', '/images/projects/J118/specs-02.jpg', 'images/projects/J118', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/J118/specs-03.jpg', '/images/projects/J118/specs-03.jpg', 'images/projects/J118', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/J118/specs-04.jpg', '/images/projects/J118/specs-04.jpg', 'images/projects/J118', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/J118/specs-05.jpg', '/images/projects/J118/specs-05.jpg', 'images/projects/J118', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/J191/cover.jpg', '/images/projects/J191/cover.jpg', 'images/projects/J191', 'cover.jpg', 'jpg', 'image/jpeg', 457915, '830b8c4d45b7eb22983c86996539c823a9adf700b0353ac1a75500070d5b62c0'),
  ('images/projects/J191/floorplan-01.jpg', '/images/projects/J191/floorplan-01.jpg', 'images/projects/J191', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/J191/floorplan-02.jpg', '/images/projects/J191/floorplan-02.jpg', 'images/projects/J191', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/J191/floorplan-03.jpg', '/images/projects/J191/floorplan-03.jpg', 'images/projects/J191', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/J191/floorplan-04.jpg', '/images/projects/J191/floorplan-04.jpg', 'images/projects/J191', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/J191/gallery-01.jpg', '/images/projects/J191/gallery-01.jpg', 'images/projects/J191', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/J191/gallery-02.jpg', '/images/projects/J191/gallery-02.jpg', 'images/projects/J191', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/J191/gallery-03.jpg', '/images/projects/J191/gallery-03.jpg', 'images/projects/J191', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/J191/gallery-04.jpg', '/images/projects/J191/gallery-04.jpg', 'images/projects/J191', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/J191/hero.jpg', '/images/projects/J191/hero.jpg', 'images/projects/J191', 'hero.jpg', 'jpg', 'image/jpeg', 468490, '75e0c6bfc1bfa8bf261e535c498c2f632027a3cc8206a63bbaf355d97fd6f50d'),
  ('images/projects/J191/location-map.jpg', '/images/projects/J191/location-map.jpg', 'images/projects/J191', 'location-map.jpg', 'jpg', 'image/jpeg', 3019721, '9191bad2812640c81d890697076ba1853a90f8301cc743970a98f58ff5e1ac3f'),
  ('images/projects/J191/progress-01.jpg', '/images/projects/J191/progress-01.jpg', 'images/projects/J191', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/J191/progress-02.jpg', '/images/projects/J191/progress-02.jpg', 'images/projects/J191', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/J191/progress-03.jpg', '/images/projects/J191/progress-03.jpg', 'images/projects/J191', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/J191/progress-04.jpg', '/images/projects/J191/progress-04.jpg', 'images/projects/J191', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/J191/progress-05.jpg', '/images/projects/J191/progress-05.jpg', 'images/projects/J191', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/J191/specs-01.jpg', '/images/projects/J191/specs-01.jpg', 'images/projects/J191', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/J191/specs-02.jpg', '/images/projects/J191/specs-02.jpg', 'images/projects/J191', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/J191/specs-03.jpg', '/images/projects/J191/specs-03.jpg', 'images/projects/J191', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/J191/specs-04.jpg', '/images/projects/J191/specs-04.jpg', 'images/projects/J191', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/J191/specs-05.jpg', '/images/projects/J191/specs-05.jpg', 'images/projects/J191', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/beit-elwatan-map1.webp', '/images/projects/beit-elwatan-map1.webp', 'images/projects', 'beit-elwatan-map1.webp', 'webp', 'image/webp', 276136, '667d000e756a8d3af676b05ed73b6ac143930c8845d74d8d0d232858375592eb'),
  ('images/projects/beit-elwatan-map11.jpg', '/images/projects/beit-elwatan-map11.jpg', 'images/projects', 'beit-elwatan-map11.jpg', 'jpg', 'image/jpeg', 3347496, '066cf3ba930814394dd4157b63d6da789d19883fab606908817e6d32519973fc'),
  ('images/projects/d174/cover.jpg', '/images/projects/d174/cover.jpg', 'images/projects/d174', 'cover.jpg', 'jpg', 'image/jpeg', 361508, 'b393c8b7baa8b02e396635292ef9e2d833d07e1546bcb4709644423f8de1b09f'),
  ('images/projects/d174/floorplan-01.jpg', '/images/projects/d174/floorplan-01.jpg', 'images/projects/d174', 'floorplan-01.jpg', 'jpg', 'image/jpeg', 91535, '16b5d4e3967491bfb19d351c6fc9490c17e32b7a5f2e9c51a78899a4af7570de'),
  ('images/projects/d174/floorplan-02.jpg', '/images/projects/d174/floorplan-02.jpg', 'images/projects/d174', 'floorplan-02.jpg', 'jpg', 'image/jpeg', 98726, '2b7ac9fbb635b903c57b8824c231cb8f90ed4f43b2e09ef2f94730a0359d9e64'),
  ('images/projects/d174/floorplan-03.jpg', '/images/projects/d174/floorplan-03.jpg', 'images/projects/d174', 'floorplan-03.jpg', 'jpg', 'image/jpeg', 98440, '4221b4eb5958058f5d80ea34a68acdef058424615d31c011e32d829ecbf0922f'),
  ('images/projects/d174/floorplan-04.jpg', '/images/projects/d174/floorplan-04.jpg', 'images/projects/d174', 'floorplan-04.jpg', 'jpg', 'image/jpeg', 102311, '4c4678683eecccbf93a4e80bfbe8959704f86dd8e975ef5aa35a3a052d09ed05'),
  ('images/projects/d174/gallery-01.jpg', '/images/projects/d174/gallery-01.jpg', 'images/projects/d174', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/d174/gallery-02.jpg', '/images/projects/d174/gallery-02.jpg', 'images/projects/d174', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/d174/gallery-03.jpg', '/images/projects/d174/gallery-03.jpg', 'images/projects/d174', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/d174/gallery-04.jpg', '/images/projects/d174/gallery-04.jpg', 'images/projects/d174', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/d174/hero.jpg', '/images/projects/d174/hero.jpg', 'images/projects/d174', 'hero.jpg', 'jpg', 'image/jpeg', 388059, 'a3170adbeee8796b0c63b6b852b64c6b605f79cf66185b33b033c2d19b3acac0'),
  ('images/projects/d174/location-map.jpg', '/images/projects/d174/location-map.jpg', 'images/projects/d174', 'location-map.jpg', 'jpg', 'image/jpeg', 2469714, '97c2acd2f26ce20732bce76cdfdd1533fc6e49e3b5161755ac637773f1711db4'),
  ('images/projects/d174/overview-01.jpg', '/images/projects/d174/overview-01.jpg', 'images/projects/d174', 'overview-01.jpg', 'jpg', 'image/jpeg', 468490, '75e0c6bfc1bfa8bf261e535c498c2f632027a3cc8206a63bbaf355d97fd6f50d'),
  ('images/projects/d174/overview-02.jpg', '/images/projects/d174/overview-02.jpg', 'images/projects/d174', 'overview-02.jpg', 'jpg', 'image/jpeg', 439189, 'b930c547638dbbaeee217b5a8b5cc19a9e96cd8450ce8e92ae548d3e584af071'),
  ('images/projects/d174/overview-033.jpg', '/images/projects/d174/overview-033.jpg', 'images/projects/d174', 'overview-033.jpg', 'jpg', 'image/jpeg', 485834, '9c78492d122230c4cda894ffd308ae099de8b853232d2507060e29e22591963a'),
  ('images/projects/d174/progress-01.jpg', '/images/projects/d174/progress-01.jpg', 'images/projects/d174', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/d174/progress-02.jpg', '/images/projects/d174/progress-02.jpg', 'images/projects/d174', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/d174/progress-03.jpg', '/images/projects/d174/progress-03.jpg', 'images/projects/d174', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/d174/progress-04.jpg', '/images/projects/d174/progress-04.jpg', 'images/projects/d174', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/d174/progress-05.jpg', '/images/projects/d174/progress-05.jpg', 'images/projects/d174', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/d174/specs-01.jpg', '/images/projects/d174/specs-01.jpg', 'images/projects/d174', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/d174/specs-02.jpg', '/images/projects/d174/specs-02.jpg', 'images/projects/d174', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/d174/specs-03.jpg', '/images/projects/d174/specs-03.jpg', 'images/projects/d174', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/d174/specs-04.jpg', '/images/projects/d174/specs-04.jpg', 'images/projects/d174', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/d174/specs-05.jpg', '/images/projects/d174/specs-05.jpg', 'images/projects/d174', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/i76/cover.jpg', '/images/projects/i76/cover.jpg', 'images/projects/i76', 'cover.jpg', 'jpg', 'image/jpeg', 583086, '114971396c559c53eeffdbdf6ae948970a8bdd3cbd08f9062a8e57de876638f7'),
  ('images/projects/i76/gallery-01.jpg', '/images/projects/i76/gallery-01.jpg', 'images/projects/i76', 'gallery-01.jpg', 'jpg', 'image/jpeg', 261828, 'be0150444554861b45fa6402aa014d64bc667d49dbcc7877ae494a7137b2abfd'),
  ('images/projects/i76/gallery-02.jpg', '/images/projects/i76/gallery-02.jpg', 'images/projects/i76', 'gallery-02.jpg', 'jpg', 'image/jpeg', 258666, '5e3d42a6cdce60af5963f798547219725b9f83ceb87a32ac7baea23fdbf88b99'),
  ('images/projects/i76/gallery-03.jpg', '/images/projects/i76/gallery-03.jpg', 'images/projects/i76', 'gallery-03.jpg', 'jpg', 'image/jpeg', 261828, 'bf8a2ab95198561b172b304900331eafea229b51ee5726efd583ff2b402136c0'),
  ('images/projects/i76/gallery-04.jpg', '/images/projects/i76/gallery-04.jpg', 'images/projects/i76', 'gallery-04.jpg', 'jpg', 'image/jpeg', 258666, '27f07f0c197c5e0f573fd751655a22c0217d64ca2453accf54dbf5757bcfef34'),
  ('images/projects/i76/hero.jpg', '/images/projects/i76/hero.jpg', 'images/projects/i76', 'hero.jpg', 'jpg', 'image/jpeg', 501914, '45480e996aa8322954e03e13790207dc8231d620517ac8c1b8d1e085bf7d73f9'),
  ('images/projects/i76/location-map.jpg', '/images/projects/i76/location-map.jpg', 'images/projects/i76', 'location-map.jpg', 'jpg', 'image/jpeg', 3109321, 'b556282d86b07a23f2f3ee2f82b3282290b9c094b6782cd4c2bb100725bdb2eb'),
  ('images/projects/i76/progress-01.jpg', '/images/projects/i76/progress-01.jpg', 'images/projects/i76', 'progress-01.jpg', 'jpg', 'image/jpeg', 262155, '4f8835b0ec55c13bc70e24a825e2a77366a25059de1960ef568756529d556cab'),
  ('images/projects/i76/progress-02.jpg', '/images/projects/i76/progress-02.jpg', 'images/projects/i76', 'progress-02.jpg', 'jpg', 'image/jpeg', 258993, '4a507843895e45c8a466bd76ded05badc1ff33ae1798a774ea7c3418e436fdad'),
  ('images/projects/i76/progress-03.jpg', '/images/projects/i76/progress-03.jpg', 'images/projects/i76', 'progress-03.jpg', 'jpg', 'image/jpeg', 262155, '5f6a38ece60f0a9d507d36e4a1f1658032140cb3da573cfc73e5c61c743592a8'),
  ('images/projects/i76/progress-04.jpg', '/images/projects/i76/progress-04.jpg', 'images/projects/i76', 'progress-04.jpg', 'jpg', 'image/jpeg', 258993, '18220e13ba346b3aa1ef511ac7565d29de11243c12524315ec7f1d1f40448051'),
  ('images/projects/i76/progress-05.jpg', '/images/projects/i76/progress-05.jpg', 'images/projects/i76', 'progress-05.jpg', 'jpg', 'image/jpeg', 258993, 'cd55ba3f4d6129dc1f252e4a7382fc708ab4cdf4bbb9334665df3d86c8744592'),
  ('images/projects/i76/specs-01.jpg', '/images/projects/i76/specs-01.jpg', 'images/projects/i76', 'specs-01.jpg', 'jpg', 'image/jpeg', 575014, 'a4150326c86bf59985a95c7b566f5075a5bf1c06a169614c5bc3da5a2857e247'),
  ('images/projects/i76/specs-02.jpg', '/images/projects/i76/specs-02.jpg', 'images/projects/i76', 'specs-02.jpg', 'jpg', 'image/jpeg', 537101, '466cc83f70009a632bf507582c5062aaac61b847aa824428f9342a96a0540041'),
  ('images/projects/i76/specs-03.jpg', '/images/projects/i76/specs-03.jpg', 'images/projects/i76', 'specs-03.jpg', 'jpg', 'image/jpeg', 385779, 'dfd2bbdd23c76ec53a48e76fb8339a14be2a8414ce9675a1b2da68693c748962'),
  ('images/projects/i76/specs-04.jpg', '/images/projects/i76/specs-04.jpg', 'images/projects/i76', 'specs-04.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d'),
  ('images/projects/i76/specs-05.jpg', '/images/projects/i76/specs-05.jpg', 'images/projects/i76', 'specs-05.jpg', 'jpg', 'image/jpeg', 484831, '29d587cdae8b060f82ffd3008eed03db5fa918ceaba0fc528a27d451392bc13d');

do $$
begin
  if (select count(*) from legacy_project_media_seed) <> 270 then
    raise exception 'legacy project media seed must contain exactly 270 canonical assets';
  end if;

  if exists (
    select 1
    from legacy_project_media_seed
    group by lower(public_url)
    having count(*) > 1
  ) then
    raise exception 'legacy project media contains case-insensitive identity collisions';
  end if;
end;
$$;

insert into public.media_folders (
  normalized_path,
  parent_path,
  display_name
)
values
  ('images', null, 'images'),
  ('images/projects', 'images', 'projects'),
  ('images/projects/B137', 'images/projects', 'B137'),
  ('images/projects/B138', 'images/projects', 'B138'),
  ('images/projects/B84', 'images/projects', 'B84'),
  ('images/projects/C35', 'images/projects', 'C35'),
  ('images/projects/d174', 'images/projects', 'd174'),
  ('images/projects/F222', 'images/projects', 'F222'),
  ('images/projects/F92', 'images/projects', 'F92'),
  ('images/projects/i76', 'images/projects', 'i76'),
  ('images/projects/I87', 'images/projects', 'I87'),
  ('images/projects/J118', 'images/projects', 'J118'),
  ('images/projects/J191', 'images/projects', 'J191')
on conflict (normalized_path) do nothing;

insert into public.media_assets (
  provider,
  bucket,
  object_key,
  public_url,
  original_filename,
  display_name,
  media_kind,
  mime_type,
  extension,
  byte_size,
  checksum,
  folder_path,
  status,
  reconciliation_state,
  missing_object,
  metadata
)
select
  'filesystem',
  'public',
  seed.object_key,
  seed.public_url,
  seed.original_filename,
  seed.original_filename,
  'image',
  seed.mime_type,
  seed.extension,
  seed.byte_size,
  seed.checksum,
  seed.folder_path,
  'active',
  'synced',
  false,
  jsonb_build_object(
    'legacyProjectMedia', true,
    'readOnly', true,
    'source', 'public'
  )
from legacy_project_media_seed seed
on conflict (provider, bucket, object_key) do update
set
  public_url = excluded.public_url,
  original_filename = excluded.original_filename,
  display_name = excluded.display_name,
  media_kind = excluded.media_kind,
  mime_type = excluded.mime_type,
  extension = excluded.extension,
  byte_size = excluded.byte_size,
  checksum = excluded.checksum,
  folder_path = excluded.folder_path,
  status = 'active',
  reconciliation_state = 'synced',
  missing_object = false,
  metadata = public.media_assets.metadata || excluded.metadata,
  updated_at = now();

do $$
begin
  if exists (
    with project_values(value) as (
      select image from public.projects
      union all select hero_image from public.projects
      union all select small_box_image from public.projects
      union all select overview_main_image from public.projects
      union all select og_image from public.projects
      union all select image from public.project_media
      union all select architectural_image from public.project_floor_plans
      union all select furnishing_image from public.project_floor_plans
      union all select poster_image from public.project_videos
    )
    select 1
    from project_values project_value
    where project_value.value ~* '^/images/'
      and not exists (
        select 1
        from legacy_project_media_seed seed
        where lower(seed.public_url) = lower(project_value.value)
      )
  ) then
    raise exception 'a legacy Project media reference has no canonical public asset';
  end if;
end;
$$;

update public.projects target
set image = seed.public_url
from legacy_project_media_seed seed
where target.image ~* '^/images/'
  and lower(target.image) = lower(seed.public_url)
  and target.image <> seed.public_url;

update public.projects target
set hero_image = seed.public_url
from legacy_project_media_seed seed
where target.hero_image ~* '^/images/'
  and lower(target.hero_image) = lower(seed.public_url)
  and target.hero_image <> seed.public_url;

update public.projects target
set small_box_image = seed.public_url
from legacy_project_media_seed seed
where target.small_box_image ~* '^/images/'
  and lower(target.small_box_image) = lower(seed.public_url)
  and target.small_box_image <> seed.public_url;

update public.projects target
set overview_main_image = seed.public_url
from legacy_project_media_seed seed
where target.overview_main_image ~* '^/images/'
  and lower(target.overview_main_image) = lower(seed.public_url)
  and target.overview_main_image <> seed.public_url;

update public.projects target
set og_image = seed.public_url
from legacy_project_media_seed seed
where target.og_image ~* '^/images/'
  and lower(target.og_image) = lower(seed.public_url)
  and target.og_image <> seed.public_url;

update public.project_media target
set image = seed.public_url
from legacy_project_media_seed seed
where target.image ~* '^/images/'
  and lower(target.image) = lower(seed.public_url)
  and target.image <> seed.public_url;

update public.project_floor_plans target
set architectural_image = seed.public_url
from legacy_project_media_seed seed
where target.architectural_image ~* '^/images/'
  and lower(target.architectural_image) = lower(seed.public_url)
  and target.architectural_image <> seed.public_url;

update public.project_floor_plans target
set furnishing_image = seed.public_url
from legacy_project_media_seed seed
where target.furnishing_image ~* '^/images/'
  and lower(target.furnishing_image) = lower(seed.public_url)
  and target.furnishing_image <> seed.public_url;

update public.project_videos target
set poster_image = seed.public_url
from legacy_project_media_seed seed
where target.poster_image ~* '^/images/'
  and lower(target.poster_image) = lower(seed.public_url)
  and target.poster_image <> seed.public_url;

with project_references as (
  select
    'projects'::text as domain_key,
    'project'::text as entity_type,
    project.id::text as entity_identity,
    project.arabic_name::text as entity_label,
    field.field_key,
    field.public_url,
    concat('/admin/projects/', project.id) as edit_href
  from public.projects project
  cross join lateral (
    values
      ('image', project.image),
      ('hero_image', project.hero_image),
      ('small_box_image', project.small_box_image),
      ('overview_main_image', project.overview_main_image),
      ('og_image', project.og_image)
  ) field(field_key, public_url)
  where field.public_url is not null

  union all

  select
    'project_media',
    'project_media',
    item.id::text,
    item.id::text,
    'image',
    item.image,
    concat('/admin/projects/', item.project_id)
  from public.project_media item
  where item.image is not null

  union all

  select
    'project_floor_plans',
    'project_floor_plan',
    item.id::text,
    item.id::text,
    field.field_key,
    field.public_url,
    concat('/admin/projects/', item.project_id)
  from public.project_floor_plans item
  cross join lateral (
    values
      ('architectural_image', item.architectural_image),
      ('furnishing_image', item.furnishing_image)
  ) field(field_key, public_url)
  where field.public_url is not null

  union all

  select
    'project_videos',
    'project_video',
    item.id::text,
    item.id::text,
    'poster_image',
    item.poster_image,
    concat('/admin/projects/', item.project_id)
  from public.project_videos item
  where item.poster_image is not null
)
insert into public.media_references (
  asset_id,
  domain_key,
  entity_type,
  entity_identity,
  entity_label,
  field_key,
  edit_href,
  public_href,
  reference_state,
  restorable,
  metadata
)
select
  asset.id,
  reference.domain_key,
  reference.entity_type,
  reference.entity_identity,
  reference.entity_label,
  reference.field_key,
  reference.edit_href,
  null,
  'active',
  false,
  jsonb_build_object('backfill', 'legacy-project-media-canonicalization')
from project_references reference
join public.media_assets asset
  on asset.provider = 'filesystem'
 and asset.bucket = 'public'
 and asset.public_url = reference.public_url
on conflict (
  asset_id,
  domain_key,
  entity_type,
  entity_identity,
  field_key
) do update
set
  entity_label = excluded.entity_label,
  edit_href = excluded.edit_href,
  public_href = excluded.public_href,
  reference_state = excluded.reference_state,
  restorable = excluded.restorable,
  metadata = public.media_references.metadata || excluded.metadata,
  updated_at = now();

do $$
begin
  if exists (
    with project_values(value) as (
      select image from public.projects
      union all select hero_image from public.projects
      union all select small_box_image from public.projects
      union all select overview_main_image from public.projects
      union all select og_image from public.projects
      union all select image from public.project_media
      union all select architectural_image from public.project_floor_plans
      union all select furnishing_image from public.project_floor_plans
      union all select poster_image from public.project_videos
    )
    select 1
    from project_values project_value
    where project_value.value ~* '^/images/'
      and not exists (
        select 1
        from public.media_assets asset
        where asset.provider = 'filesystem'
          and asset.bucket = 'public'
          and asset.public_url = project_value.value
          and asset.object_key = ltrim(project_value.value, '/')
          and asset.status = 'active'
      )
  ) then
    raise exception 'legacy Project media canonicalization is incomplete';
  end if;
end;
$$;

commit;
