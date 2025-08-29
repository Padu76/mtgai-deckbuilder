    // Get card pool with null safety
    const { data: cardPool, error } = await supabase
      .from('cards')
      .select('*')
      .not('oracle_text', 'is', null)
      .limit(2000)