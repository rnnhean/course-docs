[00:00] One Postgres database, 64 checkout servers and 1 second where only 308 orders got through.
[00:09] A customer pressed pay and the button just spun.
[00:13] No crash and no error.
[00:15] Just one machine doing too much.
[00:18] Over the next 2 hours we build the orders database of an online grocery store.
[00:22] Postgres in Docker on one laptop.
[00:25] We load it until it struggles and we measure every second of it.
[00:30] We split one big table into months and see what that fixes and what it cannot fix.
[00:35] Then we split a million customers across four databases by hand with a router we write ourselves.
[00:41] Four small machines each holding its data in memory, about five times the orders of
[00:46] one.
[00:47] Then it breaks again, 28 checkout servers are turned away, too many clients.
[00:52] There's a small program in front of each shard called BG Bouncer and every one of them gets in.
[00:58] A flash sale with 64 buyers at once, sold exactly 50,000 units, oversold zero.
[01:04] And finally, Cytus, moving shards onto a new machine while we watch.
[01:08] Every line of code is typed live and explained line by line, so you can follow even if you have never used Docker.
[01:16] But first, let's understand what sharding really is.
[01:22] Today's topic is sharding. Let me say what it is in one sentence. Sharding means splitting
[01:31] the rows of a database across several machines so that each machine holds only part of the
[01:36] data. Each part is called a shard. A shard is a complete database of its own. It has
[01:43] the same tables and the same columns as the others. Only the rows are different.
[01:49] So one big table becomes several smaller tables on several machines and together they behave
[01:53] like one database.
[01:57] Now why would anyone do this?
[01:59] It sounds like extra work and it is.
[02:02] The reason is writes, a write if any change to the data, a new order, a new payment,
[02:08] a new message.
[02:10] In a normal database setup, every write goes to one machine.
[02:14] That machine is called the primary.
[02:17] You can add copies of the database to share the reading work.
[02:20] But each copy must repeat every write.
[02:22] So copies do not reduce the writing work at all.
[02:27] And one machine has limits.
[02:29] It has a limited number of processor cores, a limited amount of memory, and one disk.
[02:33] When the writes or the data itself grow past what one machine can handle, there is
[02:38] only one way forward.
[02:40] More machines, each taking part of the writes.
[02:43] That is sharding.
[02:45] So, when do you need it and just as important when do you not need it?
[02:52] Most companies should not shard early.
[02:54] There are cheaper steps first.
[02:56] Add the right index, add a cache, add read copies, buy a bigger machine, split a big
[03:01] table inside one machine.
[03:02] We will climb each of these steps in this video.
[03:06] You need sharding when you have climbed all of those steps.
[03:09] And still, the rights or the data do not fit on one machine you can run well.
[03:16] You do not need it if your app mostly leads.
[03:19] You do not need it if your data fits comfortably on one good machine.
[03:24] And you do not need it just because a big company uses it.
[03:29] Because sharding has a price.
[03:31] Once your data lives on many machines, some easy things become hard.
[03:36] A question about everyone now has to ask every shard.
[03:39] One very busy row still lives on one shard,
[03:42] so it can still overload one machine.
[03:45] Every app server now opens connections to every shard
[03:48] and adding one more shard can move most of your data
[03:51] if you choose the wrong row.
[03:54] There are harder problems too.
[03:56] A change that touches two shards,
[03:58] order numbers that repeat,
[04:00] backups and upgrades on many machines instead of one.
[04:03] None of these problems exist on one database.
[04:07] Sharding creates them.
[04:08] That is why engineers delay it.
[04:12] So here is what we will do step by step, like a chapter in a textbook.
[04:19] First we learn how real companies run a database, copies, backups, pools of connections
[04:23] and caches.
[04:24] This is the world sharding lives in.
[04:27] Second we build an orders database for a grocery delivery company on this laptop.
[04:32] measure it and push it until it struggles. Third, we climb the cheaper steps and we
[04:37] see what each one fixes and what it cannot fix. Fourth, we choose a shard key, split
[04:43] the data into four shards and measure again. Then we break it on purpose four
[04:48] different ways and fix each one. And fifth, we do the same thing the way
[04:53] many enterprises do it with a tool called Citus. No router code at all.
[04:59] What will you get from this? Three things you can actually do.
[05:04] One, you will be able to look at a slow database and decide if it needs sharding or something simpler.
[05:10] Two, you will be able to build a shard router, move real data into shards and measure the result.
[05:17] Three, you will be able to answer a common interview question.
[05:21] How would you shard an order's database and you will answer it with real numbers?
[05:24] One honest note.
[05:28] I gave every database a small machine on purpose so the limits appear on a laptop.
[05:33] On your machine the numbers will be different but this shape will be the same.
[05:37] number you see is printed by a real terminal.
