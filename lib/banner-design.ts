// ============================================================
// Banner Design JSON — Chuẩn tạo ảnh banner SEO (UCMAS style)
// Hỗ trợ parse JSON spec → English prompt cho AI image gen
// ============================================================

export interface BannerDesignJSON {
  ten_mau_thiet_ke?: string;
  kich_thuoc?: {
    ty_le?: string;
    kich_thuoc_de_xuat?: string;
    dinh_dang?: string;
    huong_anh?: string;
  };
  phong_cach_thiet_ke?: {
    tong_the?: string;
    cam_giac?: string;
    bo_cuc?: string;
    nhan_dien_thuong_hieu?: string;
  };
  bo_cuc_chinh?: {
    nen_anh?: {
      mo_ta?: string;
      xu_ly_nen?: string;
      vung_dat_chu?: string;
      vung_nhan_vat?: string;
    };
    logo?: {
      vi_tri?: string;
      can_le?: string;
      kich_thuoc?: string;
      mau_sac?: string;
      ghi_chu?: string;
    };
    title?: {
      vi_tri?: string;
      can_le?: string;
      chieu_rong_khoi_chu?: string;
      so_dong?: string;
      noi_dung_mau?: {
        dong_1?: string;
        dong_2?: string;
        dong_3?: string;
      };
    };
  };
  typography?: {
    dong_1?: {
      noi_dung?: string;
      mau_chu?: string;
      co_chu?: string;
      do_day?: string;
    };
    dong_2?: {
      noi_dung?: string;
      mau_chu?: string;
      co_chu?: string;
      do_day?: string;
      ghi_chu?: string;
    };
    dong_3_trong_thanh_xanh?: {
      noi_dung?: string;
      mau_chu?: string;
      mau_so_5?: string;
      co_chu?: string;
      do_day?: string;
    };
  };
  mau_sac?: {
    xanh_chu_dao?: string;
    do_nhan_dien?: string;
    trang?: string;
    den_xam_noi_dung?: string;
    nen_sang?: string;
    ghi_chu?: string;
  };
  thanh_subtitle?: {
    hinh_dang?: string;
    mau_nen?: string;
    bo_goc?: string;
    vi_tri?: string;
    kich_thuoc?: {
      chieu_rong?: string;
      chieu_cao?: string;
    };
    noi_dung?: string;
    hieu_ung?: string;
  };
  hoa_tiet_trang_tri?: {
    duong_cong_do?: {
      mo_ta?: string;
      mau?: string;
      vi_tri?: string;
      do_day?: string;
      vai_tro?: string;
    };
  };
  anh_nen?: {
    yeu_cau_anh?: {
      chu_de?: string;
      chat_luong?: string;
      vung_trong?: string;
      nhan_vat?: string;
      tranh?: string;
    };
    xu_ly_anh?: {
      lam_sang_vung_chu?: string;
      lam_mo_nen?: string;
      giu_mat_nhan_vat?: string;
    };
  };
  gradient_phu?: {
    co_su_dung?: boolean;
    mo_ta?: string;
    mau?: string;
    pham_vi?: string;
    muc_dich?: string;
  };
  // Nội dung tùy chỉnh — user override
  noi_dung_tuy_chinh?: {
    dong_1?: string;
    dong_2?: string;
    dong_3?: string;
  };
}

/**
 * Chuyển BannerDesignJSON → English prompt chi tiết để gửi AI image gen
 */
export function bannerJSONToPrompt(
  json: BannerDesignJSON,
  customContent?: { dong_1?: string; dong_2?: string; dong_3?: string },
  keyword?: string
): string {
  const parts: string[] = [];

  // ── Kích thước & định hướng ─────────────────────────────────────────────────
  const size = json.kich_thuoc?.kich_thuoc_de_xuat || '1800x945px';
  const ratio = json.kich_thuoc?.ty_le || '40:21';
  parts.push(
    `Create a professional educational blog article banner image, ${size}, aspect ratio ${ratio}, horizontal landscape orientation.`
  );

  // ── Phong cách tổng thể ─────────────────────────────────────────────────────
  const style = json.phong_cach_thiet_ke;
  if (style) {
    parts.push(
      `Overall style: ${style.tong_the || 'Clean, modern, professional'}. ` +
      `Mood: ${style.cam_giac || 'Trustworthy, warm, scientific'}. ` +
      `Brand identity: ${style.nhan_dien_thuong_hieu || 'Blue, red, and white as primary colors'}.`
    );
  }

  // ── Ảnh nền ─────────────────────────────────────────────────────────────────
  const anhNen = json.anh_nen?.yeu_cau_anh;
  if (anhNen) {
    parts.push(
      `Background image: ${anhNen.chu_de || 'Child studying, learning environment'}. ` +
      `Quality: ${anhNen.chat_luong || 'Sharp, natural lighting'}. ` +
      `Subject position: ${anhNen.nhan_vat || 'Right side or center-right of frame'}. ` +
      `${anhNen.tranh ? 'Avoid: ' + anhNen.tranh : ''}`
    );
  }

  // ── Gradient phủ ─────────────────────────────────────────────────────────────
  if (json.gradient_phu?.co_su_dung) {
    parts.push(
      `Apply a soft white/cream gradient overlay from the left edge (rgba(255,255,255,0.85)) fading to transparent at ~55% width to create a clear reading area for text on the left side.`
    );
  }

  // ── Màu sắc ─────────────────────────────────────────────────────────────────
  const colors = json.mau_sac;
  if (colors) {
    parts.push(
      `Color palette: Primary blue ${colors.xanh_chu_dao || '#1F3F99'}, accent red ${colors.do_nhan_dien || '#E11B2E'}, white ${colors.trang || '#FFFFFF'}. ` +
      `Stick strictly to blue-red-white brand colors.`
    );
  }

  // ── Typography & Text Content ────────────────────────────────────────────────
  const d1 = customContent?.dong_1 || json.typography?.dong_1?.noi_dung || json.bo_cuc_chinh?.title?.noi_dung_mau?.dong_1 || '';
  const d2 = customContent?.dong_2 || json.typography?.dong_2?.noi_dung || json.bo_cuc_chinh?.title?.noi_dung_mau?.dong_2 || '';
  const d3 = customContent?.dong_3 || json.typography?.dong_3_trong_thanh_xanh?.noi_dung || json.bo_cuc_chinh?.title?.noi_dung_mau?.dong_3 || '';

  if (d1 || d2 || d3) {
    const titleColor1 = json.typography?.dong_1?.mau_chu || '#1F3F99';
    const titleColor2 = json.typography?.dong_2?.mau_chu || '#E11B2E';
    const subtitleBg = json.thanh_subtitle?.mau_nen || '#1F3F99';

    parts.push(
      `Text layout on the LEFT 45-50% of the image:` +
      (d1 ? ` Line 1: "${d1}" in ExtraBold font, color ${titleColor1}, very large (~85-105px), left-aligned.` : '') +
      (d2 ? ` Line 2: "${d2}" in ExtraBold font, color ${titleColor2}, same large size, bold emphasis, left-aligned.` : '') +
      (d3 ? ` Below that: a rounded rectangle pill/badge with background color ${subtitleBg}, containing white text: "${d3}", with the number highlighted in red.` : '') +
      ` Font style: modern sans-serif (Montserrat ExtraBold or similar). All Vietnamese text must have correct diacritical marks.`
    );
  }

  // ── Logo ─────────────────────────────────────────────────────────────────────
  const logo = json.bo_cuc_chinh?.logo;
  if (logo) {
    parts.push(
      `Place the UCMAS logo at the ${logo.vi_tri || 'top center'} of the image, ` +
      `horizontally centered, size about ${logo.kich_thuoc || '13-16% of image width'}, ` +
      `with ${logo.mau_sac || 'red, blue, white colors'}. Keep ~50px from top edge.`
    );
  }

  // ── Trang trí ────────────────────────────────────────────────────────────────
  const trangTri = json.hoa_tiet_trang_tri?.duong_cong_do;
  if (trangTri) {
    parts.push(
      `Add a thin curved red accent line (color ${trangTri.mau || '#E11B2E'}, ${trangTri.do_day || '3-5px'}) below the subtitle badge, slightly offset to the left, for visual flow and dynamism.`
    );
  }

  // ── Spacing & layout notes ────────────────────────────────────────────────────
  parts.push(
    `Important layout rules: Do NOT place any text over the face or hands of the main subject/person. ` +
    `Keep minimum 60-90px padding from edges. The right side of the image should show the person/subject clearly without text overlapping. ` +
    `Design must feel premium, high-end, and trustworthy.`
  );

  // ── Keyword context ──────────────────────────────────────────────────────────
  if (keyword) {
    parts.push(`This banner is for an educational article about: "${keyword}".`);
  }

  // ── Final quality directives ─────────────────────────────────────────────────
  parts.push(
    `Final output requirements: photorealistic background photo with text overlay, 4K quality, crisp sharp text rendering, ` +
    `no watermarks, professional marketing banner quality. ` +
    `The Vietnamese text must be perfectly rendered with all accent marks correct.`
  );

  return parts.join(' ');
}

/**
 * Validate JSON có đúng cấu trúc chuẩn không
 */
export function validateBannerJSON(json: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!json || typeof json !== 'object') {
    return { valid: false, errors: ['JSON không hợp lệ'] };
  }

  const obj = json as Record<string, unknown>;

  // Kiểm tra các field quan trọng
  if (!obj.phong_cach_thiet_ke && !obj.bo_cuc_chinh && !obj.typography) {
    errors.push('JSON thiếu các trường cấu trúc cơ bản (phong_cach_thiet_ke, bo_cuc_chinh, typography)');
  }

  return { valid: errors.length === 0, errors };
}
