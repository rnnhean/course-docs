[00:00] Picture a large online shop.
[00:06] Thousands of customers are paying for their baskets right now.
[00:10] Each payment creates an order in a database.
[00:14] This kind of work has a name.
[00:16] It is called OLTP, which means online transaction processing.
[00:21] It means many small reads and writes each for one customer and each must finish in
[00:26] a few milliseconds.
[00:29] Now the finance team wants a report, total saleslicity for the last six months.
[00:34] That query reads millions of rows.
[00:38] If that report runs on the same database as the checkout, the checkout waits behind it.
[00:43] Customers feel it.
[00:45] So companies keep two kinds of systems.
[00:47] The live database serves customers.
[00:49] A separate analytics system, often called a data warehouse, serves the big reports.
[00:54] A pipeline copies new data from one to the other.
[00:59] Remember this split, later in the video it will save us from a hard problem.
[01:06] The live database is never just one machine.
[01:09] Let's see why.
[01:11] Postgres scale keeps a log of every change.
[01:13] It is called the write ahead log or wall for short.
[01:17] Before postgres changes a table on disk, it first writes the change to this log.
[01:22] So if the power fails, it can read the log and recover.
[01:26] Now a second database can read that Fave log and repeat every change.
[01:32] That second database is called a replica.
[01:35] The main one is called the primary.
[01:38] Companies run replicas for two reasons.
[01:40] First, safety.
[01:42] If the primary machine dies, a replica can take over in seconds.
[01:45] This is called failover.
[01:46] But the replica does not do it by itself.
[01:49] A failover tool or a managed cloud database notices the failure and makes the switch.
[01:55] reading. The order history page only reads, so it can read from a replica and leave the
[02:00] primary alone. There is small catch. The replica refuse changes a boomer later. This delay is
[02:08] called replication lag. So, a replica can briefly miss the newest order.
[02:15] And here is the important part. There is one log and it has one writer, the primary.
[02:20] A replica repeats every right. It cannot accept its own, so replicas multiply reading. They never
[02:26] multiply writing. In Chapter 5, we will build a replica and try to write to it.
[02:34] Now, a question. If a replica copies every change instantly, does it protect you from a mistake?
[02:41] No. Say a bad deploy deletes 10,000 orders at 9 o'clock in the evening.
[02:46] The replica deletes them too, a moment later.
[02:50] That is why companies also keep backups.
[02:53] Once a night they copy the whole database.
[02:55] This is called a base backup and all day they save every piece of the writer head log.
[03:01] With both, you can rebuild the database exactly as it was at one second before nine.
[03:06] This is called point and time recovery.
[03:08] The Postgres documentation describes exactly this.
[03:11] You can restore the database to its state at any time since the base backup.
[03:17] So a replica protects you from a broken machine, a backup protects you from a broken change.
[03:23] Two more tools, and then we build.
[03:28] A connection is an open line between a program and the database.
[03:32] In Postgres, each connection gets its own process on the server, with its own memory.
[03:37] So the number of connections is limited.
[03:39] The setting is called maxConnections, and the default is usually 100.
[03:44] A big company may have hundreds of app servers.
[03:47] If each one opens many connections,
[03:50] the database runs out.
[03:51] So companies put a connection pooler
[03:53] in front of the database.
[03:55] It keeps a few real connections open and lends them out.
[03:58] We will hit this limit later and fix it for real.
[04:03] The second tool is a cache.
[04:05] A cache is a small, very fast store in memory.
[04:08] Product prices, the catalog,
[04:09] and login sessions are read again and again.
[04:12] So they are kept in a cache
[04:13] And most reads never reach the database.
[04:17] But notice, a cache cannot take an order for you.
[04:20] A payment must be written to the database.
[04:22] So a cache helps reading, not writing.
[04:27] Now let's put all of this on one picture.
[04:30] Engineers think of scaling as a ladder.
[04:32] You climb one step at a time, and you only
[04:34] climb higher when the step below is not enough.
[04:38] Step one, an index.
[04:40] It makes a slow lookup fast.
[04:42] but it adds no new capacity for writes.
[04:46] Step 2.
[04:47] A cache.
[04:48] It removes repeated reads, but it cannot take writes.
[04:52] Step 3.
[04:53] Read replicas.
[04:54] They share reading and give you failover, but every replica still repeats every write.
[04:59] Step 4.
[05:00] A bigger machine.
[05:02] More cores, more memory, a faster disk.
[05:05] It helps with everything a little and it needs no code change, but it is still one
[05:09] machine with one log and one point of failure and the biggest machines cost a lot.
[05:15] Step 5 Partitioning.
[05:17] One huge table is split into smaller tables inside the famed database.
[05:21] It makes old data easy to remove and some queries faster, but it is still one machine.
[05:28] Step 6 Sharding.
[05:30] It adds writing capacity and room for data, but everything else gets harder.
[05:36] Why do companies wait so long before step 6?
[05:39] Because every step below it is cheaper, and most of them do not change the applications
[05:43] code.
[05:44] Notion, for example, sharded its Postgres database when routine maintenance called vacuum started
[05:48] to stall.
[05:49] Figma's database stack grew almost 100 times from 2020 and it shipped its first sharded
[05:55] table only in September 2023.
[05:58] So we will climb this ladder ourselves on a real database and measure each step.
[06:05] You
